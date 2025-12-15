// app/excavator/page.tsx
"use client";

import { useMemo, useState } from "react";

type WeightClass = "1-3t" | "4-6t" | "7-10t" | "11-15t" | "16-20t" | "21-30t" | "30t+";
type Undercarriage = "Rubber tracks" | "Steel tracks" | "Wheeled";
type Condition = "Excellent" | "Good" | "OK" | "Needs work";

type ExcavatorForm = {
  brand: string;
  model: string;
  year: string;
  hours: string;
  weightClass: WeightClass;
  undercarriage: Undercarriage;
  quickCoupler: boolean;
  rototilt: boolean;
  condition: Condition;
  location: string;
  notes: string;
  imageUrls: string[];

  // Lead
  name: string;
  email: string;
  phone: string;
};

export default function ExcavatorPage() {
  const [form, setForm] = useState<ExcavatorForm>({
    brand: "",
    model: "",
    year: "",
    hours: "",
    weightClass: "7-10t",
    undercarriage: "Steel tracks",
    quickCoupler: true,
    rototilt: false,
    condition: "Good",
    location: "Tromsø",
    notes: "",
    imageUrls: ["", "", ""],

    name: "",
    email: "",
    phone: "",
  });

  const [estimating, setEstimating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [estimateLow, setEstimateLow] = useState<number | null>(null);
  const [estimateHigh, setEstimateHigh] = useState<number | null>(null);
  const [estimateNote, setEstimateNote] = useState<string | null>(null);

  const payload = useMemo(() => {
    const yearNum = form.year ? Number(form.year) : undefined;
    const hoursNum = form.hours ? Number(form.hours) : undefined;

    return {
      brand: form.brand?.trim() || undefined,
      model: form.model?.trim() || undefined,
      year: Number.isFinite(yearNum) ? yearNum : undefined,
      hours: Number.isFinite(hoursNum) ? hoursNum : undefined,
      weightClass: form.weightClass,
      undercarriage: form.undercarriage,
      quickCoupler: form.quickCoupler,
      rototilt: form.rototilt,
      condition: form.condition,
      location: form.location?.trim() || undefined,
      notes: form.notes?.trim() || undefined,
      imageUrls: form.imageUrls.map(s => s.trim()).filter(Boolean),
    };
  }, [form]);

  function update<K extends keyof ExcavatorForm>(key: K, value: ExcavatorForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function runEstimate() {
    setError(null);
    setEstimating(true);
    try {
      const res = await fetch("/api/estimate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ machine_type: "excavator", payload }),
      });

      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Estimate failed");

      setEstimateLow(data.estimate_low);
      setEstimateHigh(data.estimate_high);
      setEstimateNote(data.estimate_note);
    } catch (e: any) {
      setError(e?.message ?? "Could not estimate");
    } finally {
      setEstimating(false);
    }
  }

  async function submitLead() {
    setError(null);
    setSaving(true);

    try {
      if (!form.email.trim()) throw new Error("Email krävs.");
      if (!form.brand.trim() || !form.model.trim()) throw new Error("Fyll i märke + modell.");

      // Om ingen estimat ännu, kör estimat först (autopilot)
      if (estimateLow === null || estimateHigh === null) {
        await runEstimate();
      }

      const res = await fetch("/api/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name?.trim() || null,
          email: form.email.trim(),
          phone: form.phone?.trim() || null,
          machine_type: "excavator",
          machine_payload: payload,
          estimate_low: estimateLow,
          estimate_high: estimateHigh,
          estimate_note: estimateNote,
        }),
      });

      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Could not save lead");

      // Nice UX
      alert("Lead sparad! ✅ Vi återkommer med mer exakt värde.");
      setForm((p) => ({ ...p, notes: "" }));
    } catch (e: any) {
      setError(e?.message ?? "Could not submit lead");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        <header className="space-y-2">
          <h1 className="text-3xl font-bold">Arctic Trace — Grävmaskin</h1>
          <p className="text-slate-600">
            Snabb värdering + historikspår. Fyll i basics. Få ett estimat direkt.
          </p>
        </header>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
            {error}
          </div>
        )}

        <section className="rounded-2xl bg-white shadow-sm border p-6 space-y-4">
          <h2 className="text-xl font-semibold">Maskindata</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Märke">
              <input
                className="w-full rounded-xl border p-3"
                value={form.brand}
                onChange={(e) => update("brand", e.target.value)}
                placeholder="t.ex. Volvo, CAT, Komatsu..."
              />
            </Field>

            <Field label="Modell">
              <input
                className="w-full rounded-xl border p-3"
                value={form.model}
                onChange={(e) => update("model", e.target.value)}
                placeholder="t.ex. EC220, 320D, PC210..."
              />
            </Field>

            <Field label="Årsmodell">
              <input
                className="w-full rounded-xl border p-3"
                value={form.year}
                onChange={(e) => update("year", e.target.value)}
                placeholder="t.ex. 2018"
                inputMode="numeric"
              />
            </Field>

            <Field label="Driftstimmar">
              <input
                className="w-full rounded-xl border p-3"
                value={form.hours}
                onChange={(e) => update("hours", e.target.value)}
                placeholder="t.ex. 5400"
                inputMode="numeric"
              />
            </Field>

            <Field label="Viktklass">
              <select
                className="w-full rounded-xl border p-3"
                value={form.weightClass}
                onChange={(e) => update("weightClass", e.target.value as WeightClass)}
              >
                {["1-3t","4-6t","7-10t","11-15t","16-20t","21-30t","30t+"].map((x) => (
                  <option key={x} value={x}>{x}</option>
                ))}
              </select>
            </Field>

            <Field label="Undervagn">
              <select
                className="w-full rounded-xl border p-3"
                value={form.undercarriage}
                onChange={(e) => update("undercarriage", e.target.value as Undercarriage)}
              >
                {["Steel tracks","Rubber tracks","Wheeled"].map((x) => (
                  <option key={x} value={x}>{x}</option>
                ))}
              </select>
            </Field>

            <Field label="Skick">
              <select
                className="w-full rounded-xl border p-3"
                value={form.condition}
                onChange={(e) => update("condition", e.target.value as Condition)}
              >
                {["Excellent","Good","OK","Needs work"].map((x) => (
                  <option key={x} value={x}>{x}</option>
                ))}
              </select>
            </Field>

            <Field label="Plats">
              <input
                className="w-full rounded-xl border p-3"
                value={form.location}
                onChange={(e) => update("location", e.target.value)}
                placeholder="t.ex. Tromsø"
              />
            </Field>
          </div>

          <div className="flex flex-wrap gap-4 pt-2">
            <Toggle
              label="Snabbfäste"
              checked={form.quickCoupler}
              onChange={(v) => update("quickCoupler", v)}
            />
            <Toggle
              label="Rototilt"
              checked={form.rototilt}
              onChange={(v) => update("rototilt", v)}
            />
          </div>

          <Field label="Anteckningar (valfritt)">
            <textarea
              className="w-full rounded-xl border p-3 min-h-[90px]"
              value={form.notes}
              onChange={(e) => update("notes", e.target.value)}
              placeholder="t.ex. ny underrede, nyligen servad, glapp i bom, etc..."
            />
          </Field>

          <div className="space-y-2">
            <div className="font-medium">Bilder (URL:er) — valfritt</div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {form.imageUrls.map((u, i) => (
                <input
                  key={i}
                  className="w-full rounded-xl border p-3"
                  value={u}
                  onChange={(e) => {
                    const copy = [...form.imageUrls];
                    copy[i] = e.target.value;
                    update("imageUrls", copy);
                  }}
                  placeholder={`Bild ${i + 1} URL`}
                />
              ))}
            </div>
          </div>

          <div className="flex flex-col md:flex-row gap-3 pt-2">
            <button
              onClick={runEstimate}
              disabled={estimating}
              className="rounded-xl bg-slate-900 text-white px-5 py-3 disabled:opacity-60"
            >
              {estimating ? "Räknar..." : "Få snabbestimat"}
            </button>

            <div className="flex-1 rounded-xl border bg-slate-50 p-4">
              {estimateLow && estimateHigh ? (
                <div className="space-y-1">
                  <div className="text-sm text-slate-600">Estimat</div>
                  <div className="text-2xl font-bold">
                    {formatNOK(estimateLow)} – {formatNOK(estimateHigh)}
                  </div>
                  {estimateNote && (
                    <div className="text-sm text-slate-600">{estimateNote}</div>
                  )}
                </div>
              ) : (
                <div className="text-slate-600 text-sm">
                  Klicka “Få snabbestimat” för att se ett spann.
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="rounded-2xl bg-white shadow-sm border p-6 space-y-4">
          <h2 className="text-xl font-semibold">Skicka förfrågan</h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Field label="Namn (valfritt)">
              <input
                className="w-full rounded-xl border p-3"
                value={form.name}
                onChange={(e) => update("name", e.target.value)}
                placeholder="Klas"
              />
            </Field>

            <Field label="Email *">
              <input
                className="w-full rounded-xl border p-3"
                value={form.email}
                onChange={(e) => update("email", e.target.value)}
                placeholder="du@epost.no"
              />
            </Field>

            <Field label="Telefon (valfritt)">
              <input
                className="w-full rounded-xl border p-3"
                value={form.phone}
                onChange={(e) => update("phone", e.target.value)}
                placeholder="+47..."
              />
            </Field>
          </div>

          <button
            onClick={submitLead}
            disabled={saving}
            className="w-full md:w-auto rounded-xl bg-emerald-600 text-white px-6 py-3 disabled:opacity-60"
          >
            {saving ? "Skickar..." : "Skicka lead"}
          </button>

          <p className="text-sm text-slate-600">
            MVP-mode: vi sparar din maskindata + estimat så du kan bygga “ägarsida”, historik och bättre värdering senare.
          </p>
        </section>
      </div>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="space-y-1 block">
      <div className="text-sm font-medium text-slate-700">{label}</div>
      {children}
    </label>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`rounded-xl border px-4 py-2 text-sm font-medium ${
        checked ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-800"
      }`}
    >
      {checked ? "✅ " : "⬜ "} {label}
    </button>
  );
}

function formatNOK(n: number) {
  // funkar fint i Norge/Sverige – enkel tusenseparator
  return new Intl.NumberFormat("nb-NO", { style: "currency", currency: "NOK", maximumFractionDigits: 0 }).format(n);
}
