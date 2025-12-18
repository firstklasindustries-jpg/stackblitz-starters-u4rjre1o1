"use client";

import React, { FormEvent, useEffect, useMemo, useState } from "react";

type Machine = {
  id: string;
  name: string | null;
  model: string | null;
  serial_number: string | null;
  created_at: string;
  image_url: string | null;
  year: number | null;
  hours: number | null;
};

type MachineEvent = {
  id: string;
  event_type: string;
  description: string;
  created_at: string;
  previous_hash: string | null;
  hash: string | null;
};

type MachineType = "wheel_loader" | "excavator";

type LeadBase = {
  name: string;
  email: string;
  phone?: string;
  message?: string;

  brand?: string;
  model?: string;
  year?: number | null;
  hours?: number | null;
  locationText?: string;

  valueEstimate?: number | null;
  conditionScore?: number | null;
};

export default function Home() {
  // ---- global UI ----
  const [error, setError] = useState<string | null>(null);

  // ---- machine type toggle for valuation lead ----
  const [machineType, setMachineType] = useState<MachineType>("wheel_loader");

  // ---- machines list ----
  const [machines, setMachines] = useState<Machine[]>([]);
  const [loadingMachines, setLoadingMachines] = useState(true);
  const [selectedMachine, setSelectedMachine] = useState<Machine | null>(null);

  <div className="border rounded-lg p-3 bg-slate-50 mb-4">
  <h3 className="font-semibold mb-2">Lägg till händelse</h3>

  <form onSubmit={handleAddEvent} className="flex flex-col gap-2">
    <select
      value={eventType}
      onChange={(e) => setEventType(e.target.value)}
      className="border rounded px-2 py-2"
    >
      <option value="service">Service</option>
      <option value="owner_change">Ägarbyte</option>
      <option value="note">Notering</option>
    </select>

    <textarea
      value={eventDescription}
      onChange={(e) => setEventDescription(e.target.value)}
      className="border rounded px-2 py-2 min-h-[90px]"
      placeholder="Beskrivning..."
    />

    <button
      type="submit"
      disabled={savingEvent}
      className="bg-blue-600 text-white rounded px-3 py-2 font-semibold disabled:opacity-60"
    >
      {savingEvent ? "Sparar..." : "Spara händelse"}
    </button>
  </form>
</div>

<div className="flex items-center gap-3 mb-2">
  <button
    type="button"
    onClick={handleVerifyChain}
    disabled={verifying || !selectedMachine}
    className="text-xs bg-emerald-600 text-white px-3 py-1 rounded disabled:opacity-60"
  >
    {verifying ? "Verifierar..." : "Verifiera kedja"}
  </button>

  {verifyMessage && (
    <span
      className={`text-xs ${
        verifyOk === false ? "text-red-600" : verifyOk === true ? "text-emerald-700" : "text-gray-600"
      }`}
    >
      {verifyMessage}
    </span>
  )}
</div>

  
  // ---- events ----
  const [events, setEvents] = useState<MachineEvent[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);

  // ---- add machine form ----
  const [mName, setMName] = useState("");
  const [mModel, setMModel] = useState("");
  const [mSerial, setMSerial] = useState("");
  const [mYear, setMYear] = useState<string>("");
  const [mHours, setMHours] = useState<string>("");
  const [savingMachine, setSavingMachine] = useState(false);

  // ---- lead form state ----
  const [leadSubmitting, setLeadSubmitting] = useState(false);
  const [leadSent, setLeadSent] = useState(false);
  const [leadError, setLeadError] = useState<string | null>(null);

  // lead basics
  const [leadName, setLeadName] = useState("");
  const [leadEmail, setLeadEmail] = useState("");
  const [leadPhone, setLeadPhone] = useState("");
  const [leadMessage, setLeadMessage] = useState("");

  // common machine fields
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [year, setYear] = useState<string>("");
  const [hours, setHours] = useState<string>("");
  const [locationText, setLocationText] = useState("");
  const [valueEstimate, setValueEstimate] = useState<string>("");
  const [conditionScore, setConditionScore] = useState<string>("");

  // excavator extras
  const [exWeightClass, setExWeightClass] = useState<string>(""); // e.g. 14t
  const [exUndercarriage, setExUndercarriage] = useState<string>(""); // e.g. 60%
  const [exTracksType, setExTracksType] = useState<string>("steel"); // steel/rubber
  const [exQuickCoupler, setExQuickCoupler] = useState<boolean>(true);
  const [exRototilt, setExRototilt] = useState<boolean>(false);
  const [exBucketSize, setExBucketSize] = useState<string>(""); // liters
  const [exExtraHydraulics, setExExtraHydraulics] = useState<boolean>(false);

  // excavator estimate range (optional)
  const [estimateLow, setEstimateLow] = useState<string>("");
  const [estimateHigh, setEstimateHigh] = useState<string>("");
  const [estimateNote, setEstimateNote] = useState<string>("");

  const [eventType, setEventType] = useState("service");
const [eventDescription, setEventDescription] = useState("");
const [savingEvent, setSavingEvent] = useState(false);

const [verifying, setVerifying] = useState(false);
const [verifyMessage, setVerifyMessage] = useState<string | null>(null);
const [verifyOk, setVerifyOk] = useState<boolean | null>(null);


  // ---------- helpers ----------
  const toNumOrNull = (v: string) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };

  // ---------- API: machines ----------
  const fetchMachines = async () => {
    setLoadingMachines(true);
    setError(null);

    try {
      const res = await fetch("/api/machines");
      const json = await res.json();

      if (!json.ok) throw new Error(json.error || "Kunde inte hämta maskiner.");
      setMachines((json.machines || []) as Machine[]);
    } catch (e: any) {
      console.error(e);
      setError("Kunde inte hämta maskiner.");
    } finally {
      setLoadingMachines(false);
    }
  };

  const fetchEvents = async (machineId: string) => {
    setLoadingEvents(true);
    setError(null);

  const handleAddEvent = async (e: FormEvent) => {
  e.preventDefault();
  setError(null);

  if (!selectedMachine) {
    setError("Välj en maskin först.");
    return;
  }
  if (!eventDescription.trim()) {
    setError("Skriv en beskrivning för händelsen.");
    return;
  }

  setSavingEvent(true);
  setVerifyMessage(null);
  setVerifyOk(null);

  try {
    const res = await fetch("/api/machines/events/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        machine_id: selectedMachine.id,
        event_type: eventType,
        description: eventDescription.trim(),
        data: null,
      }),
    });

    const json = await res.json();
    if (!json.ok) throw new Error(json.error || "Kunde inte spara händelsen.");

    setEventDescription("");
    await fetchEvents(selectedMachine.id);
  } catch (err: any) {
    console.error(err);
    setError(err?.message || "Kunde inte spara händelsen.");
  } finally {
    setSavingEvent(false);
  }
};

const handleVerifyChain = async () => {
  if (!selectedMachine) {
    setError("Välj en maskin först.");
    return;
  }

  setVerifying(true);
  setVerifyMessage("Verifierar kedja...");
  setVerifyOk(null);

  try {
    const res = await fetch(
      `/api/machines/events/verify?machineId=${encodeURIComponent(selectedMachine.id)}`
    );
    const json = await res.json();

    if (!json.ok) throw new Error(json.error || "Kunde inte verifiera kedjan.");

    setVerifyOk(!!json.verified);
    setVerifyMessage(json.message || (json.verified ? "Kedjan är intakt ✅" : "Kedjan är bruten ❌"));
  } catch (err: any) {
    console.error(err);
    setVerifyOk(false);
    setVerifyMessage(null);
    setError(err?.message || "Kunde inte verifiera kedjan.");
  } finally {
    setVerifying(false);
  }
};

    

    try {
      const res = await fetch(
        `/api/machines/events?machineId=${encodeURIComponent(machineId)}`
      );
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "Kunde inte hämta historik.");
      setEvents((json.events || []) as MachineEvent[]);
    } catch (e: any) {
      console.error(e);
      setError("Kunde inte hämta historik.");
    } finally {
      setLoadingEvents(false);
    }
  };

  useEffect(() => {
    fetchMachines();
  }, []);

  const handleSelectMachine = (m: Machine) => {
    setSelectedMachine(m);
    setEvents([]);
    fetchEvents(m.id);
  };

  const handleAddMachine = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!mName || !mModel || !mSerial) {
      setError("Fyll i namn, modell och serienummer.");
      return;
    }

    setSavingMachine(true);

    try {
      const res = await fetch("/api/machines/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: mName,
          model: mModel,
          serial_number: mSerial,
          year: mYear ? Number(mYear) : null,
          hours: mHours ? Number(mHours) : null,
        }),
      });

      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "Kunde inte spara maskin.");

      // refresh list
      await fetchMachines();

      // reset form
      setMName("");
      setMModel("");
      setMSerial("");
      setMYear("");
      setMHours("");
    } catch (e: any) {
      console.error(e);
      setError(e?.message || "Kunde inte spara maskin.");
    } finally {
      setSavingMachine(false);
    }
  };

  // ---------- Lead payload ----------
  const leadPayload = useMemo(() => {
    const base: LeadBase = {
      name: leadName.trim(),
      email: leadEmail.trim(),
      phone: leadPhone.trim() || undefined,
      message: leadMessage.trim() || undefined,

      brand: brand.trim() || undefined,
      model: model.trim() || undefined,
      year: year ? toNumOrNull(year) : null,
      hours: hours ? toNumOrNull(hours) : null,
      locationText: locationText.trim() || undefined,

      valueEstimate: valueEstimate ? toNumOrNull(valueEstimate) : null,
      conditionScore: conditionScore ? toNumOrNull(conditionScore) : null,
    };

    // machine_payload differs per type
    if (machineType === "wheel_loader") {
      return {
        ...base,
        machine_type: "wheel_loader",
        machine_payload: {
          // keep it simple + expandable
          notes: "wheel_loader_form",
        },
      };
    }

    // excavator
    return {
      ...base,
      machine_type: "excavator",
      machine_payload: {
        weight_class: exWeightClass || null,
        undercarriage_percent: exUndercarriage || null,
        tracks_type: exTracksType || null,
        quick_coupler: exQuickCoupler,
        rototilt: exRototilt,
        bucket_size_liters: exBucketSize ? toNumOrNull(exBucketSize) : null,
        extra_hydraulics: exExtraHydraulics,
      },
      estimate_low: estimateLow ? toNumOrNull(estimateLow) : null,
      estimate_high: estimateHigh ? toNumOrNull(estimateHigh) : null,
      estimate_note: estimateNote.trim() || null,
    };
  }, [
    machineType,
    leadName,
    leadEmail,
    leadPhone,
    leadMessage,
    brand,
    model,
    year,
    hours,
    locationText,
    valueEstimate,
    conditionScore,
    exWeightClass,
    exUndercarriage,
    exTracksType,
    exQuickCoupler,
    exRototilt,
    exBucketSize,
    exExtraHydraulics,
    estimateLow,
    estimateHigh,
    estimateNote,
  ]);

  // ---------- Lead submit (ONLY via /api/lead) ----------
  const handleLeadSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLeadSubmitting(true);
    setLeadSent(false);
    setLeadError(null);

    try {
      if (!leadPayload.email) {
        throw new Error("E-post krävs.");
      }

      const res = await fetch("/api/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(leadPayload),
      });

      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "Kunde inte skicka förfrågan.");

      setLeadSent(true);

      // reset only the lead contact + message (keep machineType selection)
      setLeadName("");
      setLeadEmail("");
      setLeadPhone("");
      setLeadMessage("");

      // optional reset machine fields
      setBrand("");
      setModel("");
      setYear("");
      setHours("");
      setLocationText("");
      setValueEstimate("");
      setConditionScore("");

      // excavator optional reset
      setExWeightClass("");
      setExUndercarriage("");
      setExTracksType("steel");
      setExQuickCoupler(true);
      setExRototilt(false);
      setExBucketSize("");
      setExExtraHydraulics(false);
      setEstimateLow("");
      setEstimateHigh("");
      setEstimateNote("");
    } catch (e: any) {
      console.error(e);
      setLeadError(e?.message || "Kunde inte skicka förfrågan.");
    } finally {
      setLeadSubmitting(false);
    }
  };

  // ---------- UI ----------
  return (
    <main className="min-h-screen flex flex-col items-center p-6 gap-8 bg-slate-50">
      <header className="w-full max-w-5xl">
        <h1 className="text-3xl font-bold text-center">
          Arctic Trace – MVP
        </h1>
        <p className="text-sm text-gray-600 mt-2 text-center">
          Maskiner, historik och värderings-leads. Allt på samma sida. ✅
        </p>
      </header>

      {error && <p className="text-sm text-red-500">{error}</p>}

      {/* MACHINES */}
      <section className="w-full max-w-5xl grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left */}
        <div className="bg-white shadow-md rounded-xl p-6">
          <h2 className="text-xl font-semibold mb-3">Lägg till maskin</h2>

          <form onSubmit={handleAddMachine} className="flex flex-col gap-3 mb-6">
            <input
              type="text"
              placeholder="Namn (t.ex. Cat 966)"
              value={mName}
              onChange={(e) => setMName(e.target.value)}
              className="border rounded-md px-3 py-2"
            />
            <input
              type="text"
              placeholder="Modell"
              value={mModel}
              onChange={(e) => setMModel(e.target.value)}
              className="border rounded-md px-3 py-2"
            />
            <input
              type="text"
              placeholder="Serienummer"
              value={mSerial}
              onChange={(e) => setMSerial(e.target.value)}
              className="border rounded-md px-3 py-2"
            />
            <input
              type="number"
              placeholder="Årsmodell"
              value={mYear}
              onChange={(e) => setMYear(e.target.value)}
              className="border rounded-md px-3 py-2"
            />
            <input
              type="number"
              placeholder="Timmar"
              value={mHours}
              onChange={(e) => setMHours(e.target.value)}
              className="border rounded-md px-3 py-2"
            />

            <button
              type="submit"
              disabled={savingMachine}
              className="bg-blue-600 text-white rounded-md py-2 font-semibold disabled:opacity-60"
            >
              {savingMachine ? "Sparar..." : "Spara maskin"}
            </button>
          </form>

          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xl font-semibold">Dina maskiner</h2>
            <button
              type="button"
              onClick={fetchMachines}
              className="text-xs px-3 py-1 rounded border border-slate-300"
            >
              Uppdatera
            </button>
          </div>

          {loadingMachines ? (
            <p>Laddar maskiner...</p>
          ) : machines.length === 0 ? (
            <p>Inga maskiner ännu.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {machines.map((m) => (
                <li
                  key={m.id}
                  onClick={() => handleSelectMachine(m)}
                  className={`bg-white border rounded-lg p-3 shadow-sm cursor-pointer ${
                    selectedMachine?.id === m.id ? "border-blue-500" : "border-slate-200"
                  }`}
                >
                  <p className="font-semibold">{m.name || "(utan namn)"}</p>
                  <p className="text-sm text-gray-600">
                    Modell: {m.model || "-"} • År: {m.year || "-"} • Timmar:{" "}
                    {m.hours ?? "-"}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Right */}
        <div className="bg-white shadow-md rounded-xl p-6">
          {!selectedMachine ? (
            <p>Välj en maskin till vänster för att se historik.</p>
          ) : (
            <>
              <h2 className="text-xl font-semibold mb-2">
                Maskinpass: {selectedMachine.name}
              </h2>
              <p className="text-sm text-gray-600 mb-4">
                Modell: {selectedMachine.model || "-"} • Serienr:{" "}
                {selectedMachine.serial_number || "-"}
              </p>

              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold">Historik</h3>
                <button
                  type="button"
                  onClick={() => fetchEvents(selectedMachine.id)}
                  className="text-xs px-3 py-1 rounded border border-slate-300"
                  disabled={loadingEvents}
                >
                  {loadingEvents ? "Laddar..." : "Uppdatera"}
                </button>
              </div>

              {loadingEvents ? (
                <p>Laddar historik...</p>
              ) : events.length === 0 ? (
                <p>Inga händelser ännu.</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {events.map((ev) => (
                    <li key={ev.id} className="border rounded-lg p-3 bg-gray-50">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold">{ev.event_type}</span>
                        <span className="text-[11px] text-gray-500">
                          {new Date(ev.created_at).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700 mt-1 whitespace-pre-line">
                        {ev.description}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      </section>

      {/* LEAD / VALUATION */}
      <section className="w-full max-w-5xl bg-white shadow-md rounded-xl p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
          <div>
            <h2 className="text-xl font-semibold">Skicka in för värdering</h2>
            <p className="text-sm text-gray-600">
              Välj maskintyp och fyll i. Vi sparar som lead via servern.
            </p>
          </div>

          {/* machine type toggle */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setMachineType("wheel_loader")}
              className={`px-3 py-2 rounded text-sm border ${
                machineType === "wheel_loader"
                  ? "bg-slate-900 text-white border-slate-900"
                  : "bg-white text-gray-700 border-slate-300"
              }`}
            >
              Hjullastare
            </button>
            <button
              type="button"
              onClick={() => setMachineType("excavator")}
              className={`px-3 py-2 rounded text-sm border ${
                machineType === "excavator"
                  ? "bg-slate-900 text-white border-slate-900"
                  : "bg-white text-gray-700 border-slate-300"
              }`}
            >
              Grävmaskin
            </button>
          </div>
        </div>

        <form onSubmit={handleLeadSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* left column: machine fields */}
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium">Brand</label>
              <input
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                className="border px-2 py-2 w-full rounded"
                placeholder="Volvo"
              />
            </div>

            <div>
              <label className="block text-sm font-medium">Model</label>
              <input
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="border px-2 py-2 w-full rounded"
                placeholder={machineType === "excavator" ? "EC140" : "L70H"}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium">Årsmodell</label>
                <input
                  type="number"
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                  className="border px-2 py-2 w-full rounded"
                  placeholder="2018"
                />
              </div>

              <div>
                <label className="block text-sm font-medium">Timmar</label>
                <input
                  type="number"
                  value={hours}
                  onChange={(e) => setHours(e.target.value)}
                  className="border px-2 py-2 w-full rounded"
                  placeholder="6500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium">Plats</label>
              <input
                value={locationText}
                onChange={(e) => setLocationText(e.target.value)}
                className="border px-2 py-2 w-full rounded"
                placeholder="Tromsø"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium">Uppskattat värde (NOK)</label>
                <input
                  type="number"
                  value={valueEstimate}
                  onChange={(e) => setValueEstimate(e.target.value)}
                  className="border px-2 py-2 w-full rounded"
                  placeholder="750000"
                />
              </div>

              <div>
                <label className="block text-sm font-medium">Skick (1–5)</label>
                <input
                  type="number"
                  min={1}
                  max={5}
                  value={conditionScore}
                  onChange={(e) => setConditionScore(e.target.value)}
                  className="border px-2 py-2 w-full rounded"
                  placeholder="4"
                />
              </div>
            </div>

            {/* excavator module */}
            {machineType === "excavator" && (
              <div className="border rounded-lg p-3 bg-slate-50 space-y-3">
                <p className="text-sm font-semibold">Grävmaskin – extra info</p>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium">Viktklass (t.ex. 14t)</label>
                    <input
                      value={exWeightClass}
                      onChange={(e) => setExWeightClass(e.target.value)}
                      className="border px-2 py-2 w-full rounded"
                      placeholder="14t"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium">Undercarriage %</label>
                    <input
                      value={exUndercarriage}
                      onChange={(e) => setExUndercarriage(e.target.value)}
                      className="border px-2 py-2 w-full rounded"
                      placeholder="60"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium">Bandtyp</label>
                    <select
                      value={exTracksType}
                      onChange={(e) => setExTracksType(e.target.value)}
                      className="border px-2 py-2 w-full rounded"
                    >
                      <option value="steel">Stålband</option>
                      <option value="rubber">Gummiband</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium">Skopstorlek (liter)</label>
                    <input
                      type="number"
                      value={exBucketSize}
                      onChange={(e) => setExBucketSize(e.target.value)}
                      className="border px-2 py-2 w-full rounded"
                      placeholder="700"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap gap-3 text-sm">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={exQuickCoupler}
                      onChange={(e) => setExQuickCoupler(e.target.checked)}
                    />
                    Snabbfäste
                  </label>

                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={exRototilt}
                      onChange={(e) => setExRototilt(e.target.checked)}
                    />
                    Rototilt
                  </label>

                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={exExtraHydraulics}
                      onChange={(e) => setExExtraHydraulics(e.target.checked)}
                    />
                    Extra hydraulik
                  </label>
                </div>

                <p className="text-xs text-gray-600">
                  (Detta skickas som <code>machine_payload</code>.)
                </p>
              </div>
            )}
          </div>

          {/* right column: contact + message + excavator estimate */}
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium">Namn</label>
              <input
                value={leadName}
                onChange={(e) => setLeadName(e.target.value)}
                className="border px-2 py-2 w-full rounded"
                placeholder="Ditt namn"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium">E-post</label>
              <input
                type="email"
                value={leadEmail}
                onChange={(e) => setLeadEmail(e.target.value)}
                className="border px-2 py-2 w-full rounded"
                placeholder="du@example.com"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium">Telefon</label>
              <input
                value={leadPhone}
                onChange={(e) => setLeadPhone(e.target.value)}
                className="border px-2 py-2 w-full rounded"
                placeholder="+47 …"
              />
            </div>

            <div>
              <label className="block text-sm font-medium">Meddelande</label>
              <textarea
                value={leadMessage}
                onChange={(e) => setLeadMessage(e.target.value)}
                className="border px-2 py-2 w-full rounded min-h-[110px]"
                placeholder="Beskriv maskinen, extrautrustning, fel osv."
              />
            </div>

            {machineType === "excavator" && (
              <div className="border rounded-lg p-3 bg-amber-50 space-y-3">
                <p className="text-sm font-semibold">Grävmaskin – estimat (valfritt)</p>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium">Estimat low (NOK)</label>
                    <input
                      type="number"
                      value={estimateLow}
                      onChange={(e) => setEstimateLow(e.target.value)}
                      className="border px-2 py-2 w-full rounded"
                      placeholder="450000"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium">Estimat high (NOK)</label>
                    <input
                      type="number"
                      value={estimateHigh}
                      onChange={(e) => setEstimateHigh(e.target.value)}
                      className="border px-2 py-2 w-full rounded"
                      placeholder="550000"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium">Estimat note</label>
                  <input
                    value={estimateNote}
                    onChange={(e) => setEstimateNote(e.target.value)}
                    className="border px-2 py-2 w-full rounded"
                    placeholder="ex: inkl. 2 skopor, rototilt, 60% UC"
                  />
                </div>

                <p className="text-xs text-gray-600">
                  (Skickas som <code>estimate_low</code>, <code>estimate_high</code>, <code>estimate_note</code>.)
                </p>
              </div>
            )}

            <button
              type="submit"
              className="px-4 py-3 rounded bg-black text-white font-semibold disabled:opacity-60 w-full"
              disabled={leadSubmitting}
            >
              {leadSubmitting ? "Skickar..." : "Skicka förfrågan"}
            </button>

            {leadError && <p className="text-xs text-red-500">{leadError}</p>}
            {leadSent && !leadError && (
              <p className="text-xs text-emerald-600">
                Tack! Din förfrågan är mottagen – vi hör av oss.
              </p>
            )}
          </div>
        </form>
      </section>

      <footer className="text-xs text-gray-500">
        API: <code>/api/machines</code>, <code>/api/machines/create</code>, <code>/api/machines/events</code>, <code>/api/lead</code>
      </footer>
    </main>
  );
}
