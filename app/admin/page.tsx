"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

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

export default function AdminPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const fetchLeads = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from("leads")
        .select(
          "id, name, email, phone, message, source, created_at, machine_type, status"
        )
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Supabase admin-fetch error:", error);
        setError(
          "Kunde inte hämta leads: " +
            (error.message || "okänt fel")
        );
        setLeads([]);
        return;
      }

      setLeads((data || []) as Lead[]);
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

  const updateLeadStatus = async (id: string, status: LeadStatus) => {
    try {
      setUpdatingId(id);
      setError(null);

      const { error } = await supabase
        .from("leads")
        .update({ status })
        .eq("id", id);

      if (error) {
        console.error("Supabase update status error:", error);
        setError(
          "Kunde inte uppdatera status: " +
            (error.message || "okänt fel")
        );
        return;
      }

      // uppdatera lokalt
      setLeads((prev) =>
        prev.map((lead) =>
          lead.id === id ? { ...lead, status } : lead
        )
      );
    } catch (err: any) {
      console.error("Client-fel vid status-uppdatering:", err);
      setError(
        "Client-fel vid status-uppdatering: " +
          (err?.message || "okänt fel")
      );
    } finally {
      setUpdatingId(null);
    }
  };

  useEffect(() => {
    fetchLeads();
  }, []);

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 flex justify-center">
      <div className="w-full max-w-5xl space-y-6">
        <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">Admin – Leads</h1>
            <p className="text-sm text-gray-600">
              Hantera inkommande värderingsförfrågningar.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={fetchLeads}
              className="px-3 py-1 rounded bg-slate-900 text-white text-sm"
            >
              Uppdatera
            </button>
          </div>
        </header>

        {error && (
          <p className="text-sm text-red-500">{error}</p>
        )}

        {loading ? (
          <p>Laddar leads...</p>
        ) : leads.length === 0 ? (
          <p>Inga leads ännu.</p>
        ) : (
          <div className="space-y-3">
            {leads.map((lead) => {
              const status: LeadStatus =
                (lead.status as LeadStatus) || "new";

              return (
                <div
                  key={lead.id}
                  className="bg-white rounded-lg shadow-sm border border-slate-200 p-4 text-sm space-y-2"
                >
                  {/* Header-rad */}
                  <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-2">
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
                      {lead.machine_type && (
                        <p className="text-xs text-gray-600 mt-1">
                          Maskintyp: {lead.machine_type}
                        </p>
                      )}
                    </div>
                    <div className="text-right space-y-1">
                      <p className="text-[11px] text-gray-500">
                        {new Date(
                          lead.created_at
                        ).toLocaleString()}
                      </p>
                      <p className="text-[11px] text-gray-400">
                        Källa: {lead.source || "-"}
                      </p>
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${
                          status === "new"
                            ? "bg-blue-100 text-blue-800"
                            : status === "contacted"
                            ? "bg-amber-100 text-amber-800"
                            : status === "in_progress"
                            ? "bg-purple-100 text-purple-800"
                            : status === "won"
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-gray-200 text-gray-700"
                        }`}
                      >
                        {STATUS_LABELS[status]}
                      </span>
                    </div>
                  </div>

                  {/* Meddelande */}
                  {lead.message && (
                    <p className="mt-1 text-[13px] whitespace-pre-line text-gray-800">
                      {lead.message}
                    </p>
                  )}

                  {/* Status-knappar */}
                  <div className="flex flex-wrap gap-2 pt-1 border-t border-slate-100 mt-2 pt-2">
                    <p className="text-[11px] text-gray-500 mr-2">
                      Uppdatera status:
                    </p>
                    {(
                      [
                        "new",
                        "contacted",
                        "in_progress",
                        "won",
                        "lost",
                      ] as LeadStatus[]
                    ).map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() =>
                          updateLeadStatus(lead.id, s)
                        }
                        disabled={updatingId === lead.id}
                        className={`text-[11px] px-2 py-1 rounded border ${
                          status === s
                            ? "bg-slate-900 text-white border-slate-900"
                            : "bg-white text-gray-700 border-slate-300"
                        } disabled:opacity-60`}
                      >
                        {STATUS_LABELS[s]}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}

