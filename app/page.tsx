"use client";

import {
  useEffect,
  useState,
  FormEvent,
  ChangeEvent,
} from "react";
import { supabase } from "../lib/supabaseClient";

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

// Helper för SHA-256-hash (blockchain-liknande kedja)
async function computeHash(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// Maskera serienummer för publik vy
function maskSerial(serial?: string | null): string {
  if (!serial) return "-";
  if (serial.length <= 4) return "****";
  const start = serial.slice(0, 2);
  const end = serial.slice(-2);
  return `${start}****${end}`;
}

export default function Home() {
  const [machines, setMachines] = useState<Machine[]>([]);
  const [loadingMachines, setLoadingMachines] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // formulär för ny maskin
  const [name, setName] = useState("");
  const [model, setModel] = useState("");
  const [serialNumber, setSerialNumber] = useState("");
  const [savingMachine, setSavingMachine] = useState(false);
  const [year, setYear] = useState<string>("");
  const [hours, setHours] = useState<string>("");

  // valt maskinpass
  const [selectedMachine, setSelectedMachine] = useState<Machine | null>(null);
  const [events, setEvents] = useState<MachineEvent[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);

  // formulär för ny händelse
  const [eventType, setEventType] = useState("service");
  const [eventDescription, setEventDescription] = useState("");
  const [savingEvent, setSavingEvent] = useState(false);

  // bilduppladdning
  const [uploadingImage, setUploadingImage] = useState(false);

  // verify-state
  const [verifying, setVerifying] = useState(false);
  const [verifyMessage, setVerifyMessage] = useState<string | null>(null);
  const [verifyOk, setVerifyOk] = useState<boolean | null>(null);

  // AI-förslag (ej visat än, men sparat)
  const [aiSuggestion, setAiSuggestion] = useState<{
    model: string;
    serial: string;
  } | null>(null);

  // vy-läge (ägarvy / publik vy)
  const [viewMode, setViewMode] = useState<"owner" | "public">("owner");

  // värderings-state
  const [valuation, setValuation] = useState<{
    estimated_value: number;
    confidence: number;
    comment: string | null;
  } | null>(null);

  const [condition, setCondition] = useState<{
    condition_score: number;
    condition_label: string;
    notes: string;
    risk_flags: string[];
  } | null>(null);

  const [loadingCondition, setLoadingCondition] = useState(false);

  // AI-first för ny maskin
  const [newMachineImageUrl, setNewMachineImageUrl] = useState<string | null>(
    null
  );
  const [uploadingNewMachineImage, setUploadingNewMachineImage] =
    useState(false);
  const [loadingNewMachineAi, setLoadingNewMachineAi] = useState(false);

  // hämta alla maskiner
  const fetchMachines = async () => {
    setLoadingMachines(true);
    setError(null);
    const { data, error } = await supabase
      .from("machines")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      setError("Kunde inte hämta maskiner.");
    } else {
      setMachines((data || []) as Machine[]);
    }
    setLoadingMachines(false);
  };

  // hämta events för vald maskin
  const fetchEvents = async (machineId: string) => {
    setLoadingEvents(true);
    const { data, error } = await supabase
      .from("machine_events")
      .select("*")
      .eq("machine_id", machineId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
    } else {
      setEvents((data || []) as MachineEvent[]);
    }
    setLoadingEvents(false);
  };

  useEffect(() => {
    fetchMachines();
  }, []);

  // när man klickar på en maskin i listan
  const handleSelectMachine = (m: Machine) => {
    setSelectedMachine(m);
    setEvents([]);
    setVerifyMessage(null);
    setVerifyOk(null);
    setAiSuggestion(null);
    setValuation(null);
    setCondition(null);
    fetchEvents(m.id);
  };

  // spara ny maskin
  const handleAddMachine = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name || !model || !serialNumber) {
      setError("Fyll i alla maskin-fält.");
      return;
    }

    setSavingMachine(true);

    const { error } = await supabase.from("machines").insert([
      {
        name,
        model,
        serial_number: serialNumber,
        year: year ? parseInt(year, 10) : null,
        hours: hours ? parseInt(hours, 10) : null,
      },
    ]);

    if (error) {
      console.error(error);
      setError("Kunde inte spara maskinen.");
    } else {
      setName("");
      setModel("");
      setSerialNumber("");
      setYear("");
      setHours("");
      await fetchMachines();
    }

    setSavingMachine(false);
  };

  // spara ny händelse (med blockchain-lik kedja)
  const handleAddEvent = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!selectedMachine) {
      setError("Välj en maskin först.");
      return;
    }

    if (!eventDescription) {
      setError("Skriv en beskrivning för händelsen.");
      return;
    }

    setSavingEvent(true);
    setVerifyMessage(null);
    setVerifyOk(null);

    const { data: lastEvents, error: lastError } = await supabase
      .from("machine_events")
      .select("hash")
      .eq("machine_id", selectedMachine.id)
      .order("created_at", { ascending: false })
      .limit(1);

    if (lastError) {
      console.error(lastError);
    }

    const previousHash =
      lastEvents && lastEvents.length > 0 ? lastEvents[0].hash : null;

    const payload = {
      machine_id: selectedMachine.id,
      event_type: eventType,
      description: eventDescription,
      data: null,
      previous_hash: previousHash,
    };

    const hashInput = JSON.stringify(payload);
    const hash = await computeHash(hashInput);

    const { error } = await supabase.from("machine_events").insert([
      {
        ...payload,
        hash,
      },
    ]);

    if (error) {
      console.error(error);
      setError("Kunde inte spara händelsen.");
    } else {
      setEventDescription("");
      await fetchEvents(selectedMachine.id);
    }

    setSavingEvent(false);
  };

  // verifiera kedjan för vald maskin
  const handleVerifyChain = async () => {
    if (!selectedMachine) {
      setError("Välj en maskin först.");
      return;
    }

    setVerifying(true);
    setVerifyMessage("Verifierar kedja...");
    setVerifyOk(null);

    const { data, error } = await supabase
      .from("machine_events")
      .select("id, event_type, description, created_at, previous_hash, hash")
      .eq("machine_id", selectedMachine.id)
      .order("created_at", { ascending: true });

    if (error) {
      console.error(error);
      setError("Kunde inte läsa historik för verifiering.");
      setVerifying(false);
      return;
    }

    const list = (data || []) as MachineEvent[];

    let prevHash: string | null = null;

    for (const ev of list) {
      if (ev.previous_hash !== prevHash) {
        setVerifyOk(false);
        setVerifyMessage(
          "Kedjan är bruten vid en händelse (id: " + ev.id.slice(0, 8) + "…)."
        );
        setVerifying(false);
        return;
      }

      const payload = {
        machine_id: selectedMachine.id,
        event_type: ev.event_type,
        description: ev.description,
        data: null,
        previous_hash: prevHash,
      };

      const expectedHash = await computeHash(JSON.stringify(payload));

      if (ev.hash !== expectedHash) {
        setVerifyOk(false);
        setVerifyMessage(
          "Kedjan är manipulerad vid en händelse (id: " +
            ev.id.slice(0, 8) +
            "…)."
        );
        setVerifying(false);
        return;
      }

      prevHash = ev.hash;
    }

    setVerifyOk(true);
    setVerifyMessage("Kedjan är intakt ✅");
    setVerifying(false);
  };

  // ladda upp bild för vald maskin
  const handleImageChange = async (e: ChangeEvent<HTMLInputElement>) => {
    if (!selectedMachine) {
      setError("Välj en maskin först.");
      return;
    }

    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingImage(true);
    setError(null);

    try {
      const filePath = `${selectedMachine.id}/${Date.now()}-${file.name}`;

      const { error: uploadError } = await supabase.storage
        .from("machine-images")
        .upload(filePath, file);

      if (uploadError) {
        console.error(uploadError);
        setError("Kunde inte ladda upp bild: " + uploadError.message);
        setUploadingImage(false);
        return;
      }

      const { data } = supabase.storage
        .from("machine-images")
        .getPublicUrl(filePath);

      const publicUrl = data.publicUrl;

      const { error: updateError } = await supabase
        .from("machines")
        .update({ image_url: publicUrl })
        .eq("id", selectedMachine.id);

      if (updateError) {
        console.error(updateError);
        setError("Kunde inte spara bild-URL på maskinen.");
      } else {
        setSelectedMachine((prev) =>
          prev ? { ...prev, image_url: publicUrl } : prev
        );
        fetchMachines();
      }
    } catch (err) {
      console.error(err);
      setError("Något gick fel vid bilduppladdning.");
    }

    setUploadingImage(false);
  };

  // AI-autofyll för befintlig maskin
  const handleAiDemo = async () => {
    if (!selectedMachine || !selectedMachine.image_url) {
      setError("Välj en maskin och ladda upp en bild innan AI-autofyll.");
      return;
    }

    setError(null);
    setAiSuggestion(null);

    try {
      const res = await fetch("/api/ai-scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageUrl: selectedMachine.image_url,
        }),
      });

      const text = await res.text();

      let data: any;
      try {
        data = JSON.parse(text);
      } catch {
        console.error("AI-backend gav inte JSON:", text);
        setError(
          "AI-backend gav inte JSON (troligen 404/feilsida). Första raden: " +
            text.slice(0, 80)
        );
        return;
      }

      if (!res.ok) {
        console.error(data);
        setError("AI-fel: " + (data.error || "okänt fel"));
        return;
      }

      setAiSuggestion({
        model: data.model || "",
        serial: data.serial || "",
      });
    } catch (err: any) {
      console.error(err);
      setError("Kunde inte kontakta AI-backend: " + err?.message);
    }
  };

  // Ladda upp bild för NY maskin (innan den finns i databasen)
  const handleNewMachineImageChange = async (
    e: ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setUploadingNewMachineImage(true);

    try {
      const filePath = `new/${Date.now()}-${file.name}`;

      const { error: uploadError } = await supabase.storage
        .from("machine-images")
        .upload(filePath, file);

      if (uploadError) {
        console.error(uploadError);
        setError("Kunde inte ladda upp bild för ny maskin.");
        setUploadingNewMachineImage(false);
        return;
      }

      const { data: publicData } = supabase.storage
        .from("machine-images")
        .getPublicUrl(filePath);

      const publicUrl = publicData.publicUrl;
      setNewMachineImageUrl(publicUrl);
    } catch (err) {
      console.error(err);
      setError("Något gick fel vid bilduppladdning för ny maskin.");
    }

    setUploadingNewMachineImage(false);
  };

  // AI-first: läs av modell/serienr från bild och fyll i formulärfälten
  const handleNewMachineAi = async () => {
    if (!newMachineImageUrl) {
      setError("Ladda upp en bild på maskinen först.");
      return;
    }

    setError(null);
    setLoadingNewMachineAi(true);

    try {
      const res = await fetch("/api/ai-scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageUrl: newMachineImageUrl,
        }),
      });

      const text = await res.text();

      let data: any;
      try {
        data = JSON.parse(text);
      } catch {
        console.error("AI gav inte JSON:", text);
        setError("AI-backend gav inte JSON när vi läste ny maskin.");
        setLoadingNewMachineAi(false);
        return;
      }

      if (!res.ok) {
        console.error(data);
        setError("AI-fel: " + (data.error || "okänt fel vid ny maskin."));
        setLoadingNewMachineAi(false);
        return;
      }

      const modelFromAi = data.model || "";
      const serialFromAi = data.serial || "";

      if (modelFromAi) {
        setModel(modelFromAi);
        if (!name) {
          setName(modelFromAi);
        }
      }
      if (serialFromAi) {
        setSerialNumber(serialFromAi);
      }

      setLoadingNewMachineAi(false);
    } catch (err: any) {
      console.error(err);
      setError(
        "Kunde inte kontakta AI-backend för ny maskin: " + err?.message
      );
      setLoadingNewMachineAi(false);
    }
  };

  const isOwnerView = viewMode === "owner";

  const shownSerial =
    selectedMachine &&
    (isOwnerView
      ? selectedMachine.serial_number || "-"
      : maskSerial(selectedMachine.serial_number));

  return (
    
  <main className="min-h-screen flex flex-col items-center p-6 gap-8 bg-slate-50">
    {/* HERO */}
    <section className="w-full max-w-5xl">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-slate-800 to-slate-700 text-white px-6 py-8 md:px-10 md:py-10 shadow-lg">
        <div className="max-w-xl space-y-4">
          <p className="text-xs uppercase tracking-[0.25em] text-slate-300">
            Arctic Trace · MVP
          </p>
          <h1 className="text-3xl md:text-4xl font-bold leading-tight">
            Digitalt maskinpass<br />för dina hjullastare
          </h1>
          <p className="text-sm md:text-base text-slate-200">
            Samla historik, bilder och skick i ett digitalt pass. 
            Få AI-värdering och skicka förfrågan på under 1 minut.
          </p>

          <ul className="text-xs md:text-sm space-y-1 text-slate-100">
            <li>✅ Digitalt maskinpass per maskin</li>
            <li>✅ AI-bedömning av skick &amp; marknadsvärde</li>
            <li>✅ Kedjad historik som avslöjar fusk</li>
            <li>✅ Byggd för framtida EU-krav (DPP-ready)</li>
          </ul>

          <div className="flex flex-wrap gap-3 pt-3">
            <a
              href="#machines"
              className="inline-flex items-center justify-center rounded-full bg-white text-slate-900 text-sm font-semibold px-4 py-2 shadow-sm hover:bg-slate-100 transition"
            >
              Lägg in din första maskin
            </a>
            <a
              href="#valuation-form"
              className="inline-flex items-center justify-center rounded-full border border-slate-300 text-slate-50 text-sm font-semibold px-4 py-2 hover:bg-slate-800/50 transition"
            >
              Skicka värderingsförfrågan
            </a>
          </div>
        </div>

        {/* Dekorativ “tag” i hörnet */}
        <div className="hidden md:block absolute right-6 top-6 text-right text-xs text-slate-300">
          <p className="font-semibold">AI &amp; hashad historik</p>
          <p>Byggd för tunga maskiner</p>
        </div>
      </div>
    </section>

    {/* FELMEDDELANDE */}
    {error && <p className="text-red-500 text-sm">{error}</p>}

      <section
  id="machines"
  className="w-full max-w-5xl grid grid-cols-1 md:grid-cols-2 gap-6"
>

        {/* Vänster sida: maskinregister */}
        <div className="bg-white shadow-md rounded-xl p-6">
          <h2 className="text-xl font-semibold mb-3">Lägg till maskin</h2>

          {/* Steg 1: Bild + AI-förslag */}
          <div className="mb-4">
            <p className="text-sm font-semibold mb-1">
              1. Ladda upp bild (typskylt / maskin)
            </p>
            <input
              type="file"
              accept="image/*"
              onChange={handleNewMachineImageChange}
              className="text-sm"
            />
            {uploadingNewMachineImage && (
              <p className="text-xs text-gray-500 mt-1">
                Laddar upp bild...
              </p>
            )}
            {newMachineImageUrl && (
              <p className="text-xs text-emerald-600 mt-1">
                Bild uppladdad – redo för AI.
              </p>
            )}

            <button
              type="button"
              onClick={handleNewMachineAi}
              disabled={loadingNewMachineAi || !newMachineImageUrl}
              className="mt-2 text-xs bg-purple-600 text-white px-3 py-1 rounded disabled:opacity-60"
            >
              {loadingNewMachineAi
                ? "Läser av med AI..."
                : "🔍 AI: fyll i modell & serienr från bild"}
            </button>
          </div>

          {/* Steg 2: Formulär – AI fyller i, du justerar */}
          <form
            onSubmit={handleAddMachine}
            className="flex flex-col gap-3 mb-6"
          >
            <p className="text-sm font-semibold">2. Kontrollera & komplettera</p>

            <input
              type="text"
              placeholder="Namn (t.ex. Cat 966 hjullastare)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="border rounded-md px-3 py-2"
            />
            <input
              type="text"
              placeholder="Modell"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="border rounded-md px-3 py-2"
            />
            <input
              type="text"
              placeholder="Serienummer"
              value={serialNumber}
              onChange={(e) => setSerialNumber(e.target.value)}
              className="border rounded-md px-3 py-2"
            />
            <input
              type="number"
              placeholder="Årsmodell (t.ex. 2018)"
              value={year}
              onChange={(e) => setYear(e.target.value)}
              className="border rounded-md px-3 py-2"
            />
            <input
              type="number"
              placeholder="Timmar (t.ex. 6200)"
              value={hours}
              onChange={(e) => setHours(e.target.value)}
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

          <h2 className="text-xl font-semibold mb-3">Dina maskiner</h2>
          {loadingMachines ? (
            <p>Laddar maskiner...</p>
          ) : machines.length === 0 ? (
            <p>Inga maskiner ännu. Lägg till din första ovanför.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {machines.map((m) => (
                <li
                  key={m.id}
                  onClick={() => handleSelectMachine(m)}
                  className={`bg-white border rounded-lg p-3 shadow-sm cursor-pointer ${
                    selectedMachine?.id === m.id
                      ? "border-blue-500"
                      : "border-slate-200"
                  }`}
                >
                  <p className="font-semibold">{m.name}</p>
                  <p className="text-sm text-gray-600">
                    Modell: {m.model || "-"} • År: {m.year || "-"} • Timmar:{" "}
                    {m.hours ?? "-"} • Serienr: {m.serial_number || "-"}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Höger sida: valt maskinpass */}
        <div className="bg-white shadow-md rounded-xl p-6">
          {!selectedMachine ? (
            <p>
              Välj en maskin i listan till vänster för att se maskinpass, bild,
              historik, hash-kedja – som ägare eller i publik vy.
            </p>
          ) : (
            <>
              {/* Vy-väljare */}
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xl font-semibold">
                  Maskinpass: {selectedMachine.name}
                </h2>
                <div className="flex gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => setViewMode("owner")}
                    className={`px-3 py-1 rounded-full border ${
                      isOwnerView
                        ? "bg-blue-600 text-white border-blue-600"
                        : "bg-white text-gray-700 border-gray-300"
                    }`}
                  >
                    Ägarvy
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode("public")}
                    className={`px-3 py-1 rounded-full border ${
                      !isOwnerView
                        ? "bg-emerald-600 text-white border-emerald-600"
                        : "bg-white text-gray-700 border-gray-300"
                    }`}
                  >
                    Publik vy
                  </button>
                </div>
              </div>

              <p className="text-gray-600 mb-2">
                Modell: {selectedMachine.model || "-"} • Serienr: {shownSerial}
              </p>

              {/* Värderings-knapp + AI-skick – endast i ägarvy */}
              {isOwnerView && (
                <div className="mb-4 space-y-2">
                  {/* Värderingsknapp */}
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        setError(null);
                        setValuation(null);

                        const res = await fetch("/api/valuation", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            machineId: selectedMachine.id,
                            model: selectedMachine.model,
                            year: selectedMachine.year,
                            hours: selectedMachine.hours,
                            conditionScore:
                              condition?.condition_score ?? null,
                          }),
                        });

                        const data = await res.json();

                        if (!res.ok) {
                          console.error(data);
                          setError(
                            "Kunde inte beräkna värde: " +
                              (data.error || "okänt fel")
                          );
                          return;
                        }

                        setValuation({
                          estimated_value: data.estimated_value,
                          confidence: data.confidence,
                          comment: data.comment ?? null,
                        });
                      } catch (err: any) {
                        console.error(err);
                        setError(
                          "Värderingsfel: " +
                            (err?.message || "något gick fel")
                        );
                      }
                    }}
                    className="text-xs bg-slate-900 text-white px-3 py-1 rounded"
                  >
                    🧮 Beräkna marknadsvärde
                  </button>

                  {valuation && (
                    <div className="border rounded-lg p-3 bg-amber-50">
                      <p className="text-sm font-semibold">
                        Beräknat värde:{" "}
                        <span className="text-amber-900">
                          {valuation.estimated_value.toLocaleString("sv-SE")} kr
                        </span>
                      </p>
                      <p className="text-xs text-gray-600">
                        Tillförlitlighet: {valuation.confidence} %
                      </p>
                      {valuation.comment && (
                        <p className="text-xs text-gray-700 mt-1">
                          {valuation.comment}
                        </p>
                      )}
                    </div>
                  )}

                  {/* AI-bedöm skick */}
                  <button
                    type="button"
                    onClick={async () => {
                      if (!selectedMachine?.image_url) {
                        setError("Ladda upp en bild på maskinen först.");
                        return;
                      }

                      setError(null);
                      setLoadingCondition(true);
                      setCondition(null);

                      try {
                        const res = await fetch("/api/condition", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            imageUrl: selectedMachine.image_url,
                          }),
                        });

                        const data = await res.json();

                        if (!res.ok) {
                          console.error(data);
                          setError(
                            "Kunde inte bedöma skick: " +
                              (data.error || "okänt fel")
                          );
                          setLoadingCondition(false);
                          return;
                        }

                        setCondition({
                          condition_score: data.condition_score,
                          condition_label: data.condition_label,
                          notes: data.notes,
                          risk_flags: data.risk_flags ?? [],
                        });
                        setLoadingCondition(false);
                      } catch (err: any) {
                        console.error(err);
                        setError(
                          "AI-skickbedömning misslyckades: " +
                            (err?.message || "okänt fel")
                        );
                        setLoadingCondition(false);
                      }
                    }}
                    className="text-xs bg-emerald-700 text-white px-3 py-1 rounded disabled:opacity-60"
                    disabled={loadingCondition}
                  >
                    {loadingCondition
                      ? "AI bedömer skick..."
                      : "🧠 AI-bedöm skick från bild"}
                  </button>

                  {condition && (
                    <div className="border rounded-lg p-3 bg-emerald-50">
                      <p className="text-sm font-semibold">
                        Skick: {condition.condition_label} (
                        {condition.condition_score}/5)
                      </p>
                      {condition.notes && (
                        <p className="text-xs text-gray-700 mt-1">
                          {condition.notes}
                        </p>
                      )}
                      {condition.risk_flags &&
                        condition.risk_flags.length > 0 && (
                          <p className="text-[11px] text-red-700 mt-1">
                            Risker: {condition.risk_flags.join(", ")}
                          </p>
                        )}
                    </div>
                  )}
                </div>
              )}

              {/* Bildvisning */}
              {selectedMachine.image_url ? (
                <div className="mb-4">
                  <p className="text-sm text-gray-500 mb-1">Bild:</p>
                  <img
                    src={selectedMachine.image_url}
                    alt={selectedMachine.name || "Maskinbild"}
                    className="w-full max-h-64 object-cover rounded-lg border"
                  />
                </div>
              ) : (
                <p className="text-sm text-gray-500 mb-2">
                  Ingen bild uppladdad ännu.
                </p>
              )}

              {/* Bilduppladdning – endast vettigt i ägarvy */}
              {isOwnerView && (
                <div className="mb-4">
                  <p className="text-sm font-semibold mb-1">
                    Ladda upp bild
                  </p>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="text-sm"
                  />
                  {uploadingImage && (
                    <p className="text-xs text-gray-500 mt-1">
                      Laddar upp bild...
                    </p>
                  )}
                </div>
              )}

              {/* Händelser */}
              <div className="mb-6">
                <h3 className="font-semibold mb-2">Lägg till händelse</h3>
                <form
                  onSubmit={handleAddEvent}
                  className="flex flex-col gap-3"
                >
                  <select
                    value={eventType}
                    onChange={(e) => setEventType(e.target.value)}
                    className="border rounded px-3 py-2"
                  >
                    <option value="service">Service</option>
                    <option value="owner_change">Ägarbyte</option>
                    <option value="note">Notering</option>
                  </select>

                  <textarea
                    placeholder="Beskrivning..."
                    value={eventDescription}
                    onChange={(e) =>
                      setEventDescription(e.target.value)
                    }
                    className="border rounded px-3 py-2"
                  />

                  <button
                    type="submit"
                    disabled={savingEvent}
                    className="bg-blue-600 text-white rounded-md py-2 font-semibold disabled:opacity-60"
                  >
                    {savingEvent ? "Sparar..." : "Spara händelse"}
                  </button>
                </form>
              </div>

              <div>
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="font-semibold">Historik (kedjad)</h3>
                  <button
                    onClick={handleVerifyChain}
                    disabled={verifying || events.length === 0}
                    className="text-xs bg-emerald-600 text-white px-3 py-1 rounded disabled:opacity-60"
                  >
                    {verifying ? "Verifierar..." : "Verifiera kedja"}
                  </button>
                </div>
                {verifyMessage && (
                  <p
                    className={`text-xs mb-2 ${
                      verifyOk === false
                        ? "text-red-500"
                        : verifyOk === true
                        ? "text-green-600"
                        : "text-gray-600"
                    }`}
                  >
                    {verifyMessage}
                  </p>
                )}

                {loadingEvents ? (
                  <p>Laddar historik...</p>
                ) : events.length === 0 ? (
                  <p>Inga händelser ännu.</p>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {events.map((ev) => (
                      <li
                        key={ev.id}
                        className="border rounded-lg p-3 bg-gray-50 flex flex-col"
                      >
                        <span className="font-semibold">
                          {ev.event_type === "service"
                            ? "Service"
                            : ev.event_type === "owner_change"
                            ? "Ägarbyte"
                            : "Notering"}
                        </span>
                        <span className="text-gray-700 text-sm">
                          {ev.description}
                        </span>
                        <span className="text-gray-400 text-xs mt-1">
                          {new Date(ev.created_at).toLocaleString()}
                        </span>
                        {ev.hash && (
                          <span className="text-[10px] text-gray-500 break-all mt-1">
                            Hash: {ev.hash}
                          </span>
                        )}
                        {ev.previous_hash && (
                          <span className="text-[10px] text-gray-400 break-all">
                            Previous: {ev.previous_hash}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}
        </div>
      </section>

      {/* Extra sektion: Skicka värderingsförfrågan (form mot API-route) */}
     <section
  id="valuation-form"
  className="w-full max-w-xl bg-white shadow-md rounded-xl p-6"
>

        <h2 className="text-xl font-semibold mb-4">
          Skicka värderingsförfrågan
        </h2>

        <form
    action="/api/lead"
    method="POST"
    className="space-y-4"
  >

          {/* Maskindata */}
          <div>
            <label className="block text-sm font-medium">Brand</label>
            <input
              name="brand"
              className="border px-2 py-1 w-full"
              placeholder="Volvo"
            />
          </div>

          <div>
            <label className="block text-sm font-medium">Model</label>
            <input
              name="model"
              className="border px-2 py-1 w-full"
              placeholder="L70H"
            />
          </div>

          <div>
            <label className="block text-sm font-medium">Årsmodell</label>
            <input
              type="number"
              name="year"
              className="border px-2 py-1 w-full"
              placeholder="2018"
            />
          </div>

          <div>
            <label className="block text-sm font-medium">Timmar</label>
            <input
              type="number"
              name="operating_hours"
              className="border px-2 py-1 w-full"
              placeholder="6500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium">Plats</label>
            <input
              name="location_text"
              className="border px-2 py-1 w-full"
              placeholder="Tromsø"
            />
          </div>

          {/* Värderingsdata */}
          <div>
            <label className="block text-sm font-medium">
              Uppskattat värde (NOK)
            </label>
            <input
              type="number"
              name="value_estimate"
              className="border px-2 py-1 w-full"
              placeholder="750000"
            />
          </div>

          <div>
            <label className="block text-sm font-medium">
              Skick (1–5)
            </label>
            <input
              type="number"
              name="condition_score"
              className="border px-2 py-1 w-full"
              placeholder="4"
              min={1}
              max={5}
            />
          </div>

          {/* Kontaktuppgifter */}
          <div>
            <label className="block text-sm font-medium">Namn</label>
            <input
              name="name"
              className="border px-2 py-1 w-full"
              placeholder="Ditt namn"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium">E-post</label>
            <input
              type="email"
              name="email"
              className="border px-2 py-1 w-full"
              placeholder="du@example.com"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium">Telefon</label>
            <input
              name="phone"
              className="border px-2 py-1 w-full"
              placeholder="+47 ..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium">Meddelande</label>
            <textarea
              name="message"
              className="border px-2 py-1 w-full"
              placeholder="Beskriv maskinen, extrautrustning, fel osv."
            />
          </div>

          <button
            type="submit"
            className="px-4 py-2 rounded bg-black text-white"
          >
            Skicka förfrågan
          </button>
        </form>
      </section>
    </main>
  );
}

