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

  // AI-förslag
  const [aiSuggestion, setAiSuggestion] = useState<{
    model: string;
    serial: string;
  } | null>(null);

  // NYTT: vy-läge (ägarvy / publik vy)
  const [viewMode, setViewMode] = useState<"owner" | "public">("owner");
    model: string;
    serial: string;
  } | null>(null);

  // 👉 NYTT: värderings-state
  const [valuation, setValuation] = useState<{
    estimated_value: number;
    confidence: number;
    comment: string | null;
  } | null>(null);

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
    setValuation(null); // 👉 nollställ värdering när du byter maskin
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
      },
    ]);

    if (error) {
      console.error(error);
      setError("Kunde inte spara maskinen.");
    } else {
      setName("");
      setModel("");
      setSerialNumber("");
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
  const handleImageChange = async (
    e: ChangeEvent<HTMLInputElement>
  ) => {
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

  // AI-autofyll (vision-backend)
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
  
      const text = await res.text(); // läs alltid som text först
  
      // testa om det är JSON
      let data: any;
      try {
        data = JSON.parse(text);
      } catch {
        // här vet vi att svaret INTE var JSON → troligen HTML/feilsida
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
  
  const isOwnerView = viewMode === "owner";

  const shownSerial =
    selectedMachine &&
    (isOwnerView
      ? selectedMachine.serial_number || "-"
      : maskSerial(selectedMachine.serial_number));

  return (
    <main className="min-h-screen flex flex-col items-center p-6 gap-8 bg-slate-50">
      <h1 className="text-3xl font-bold">Arctic Trace – MVP</h1>
      <p className="text-sm text-gray-600 mb-2 text-center">
        Maskiner, historik, bilder, hash-kedja & AI-autofyll – med ägarvy och
        publik vy.
      </p>

      {error && <p className="text-red-500 text-sm">{error}</p>}

      <section className="w-full max-w-5xl grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Vänster sida: maskinregister */}
        <div className="bg-white shadow-md rounded-xl p-6">
          <h2 className="text-xl font-semibold mb-3">Lägg till maskin</h2>
          <form
            onSubmit={handleAddMachine}
            className="flex flex-col gap-3 mb-6"
          >
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

            <button
              type="submit"
              disabled={savingMachine}
              className="bg-blue-600 text-white rounded-md py-2 font-semibold disabled:opacity-60"
            >
              {savingMachine ? "Sparar..." : "Lägg till maskin"}
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
                    Modell: {m.model || "-"} • Serienr:{" "}
                    {m.serial_number || "-"}
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
                Modell: {selectedMachine.model || "-"} • Serienr:{" "}
                {shownSerial}
              </p>
  
    {/* 👉 NYTT: Värderings-knapp + resultat, bara i ÄGARVY */}
    {isOwnerView && (
      <div className="mb-4">
        <button
          type="button"
          onClick={async () => {
            try {
              setError(null);
              setValuation(null);

              const res = await fetch("/api/valuation", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ machineId: selectedMachine.id }),
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
                comment: data.comment,
              });
            } catch (err: any) {
              console.error(err);
              setError(
                "Värderingsfel: " + (err?.message || "något gick fel")
              );
            }
          }}
          className="text-xs bg-slate-900 text-white px-3 py-1 rounded"
        >
          🧮 Beräkna marknadsvärde
        </button>

        {valuation && (
          <div className="mt-2 border rounded-lg p-3 bg-amber-50">
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
                  <p className="text-sm font-semibold mb-1">Ladda upp bild</p>
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

              {/* AI-autofyll – bara i ägarvy */}
              {isOwnerView && (
                <div className="mb-6">
                  <button
                    type="button"
                    onClick={handleAiDemo}
                    className="text-xs bg-purple-600 text-white px-3 py-1 rounded"
                  >
                    Testa AI-autofyll
                  </button>
                  {aiSuggestion && (
                    <p className="text-xs text-gray-700 mt-2">
                      AI-förslag: Modell:{" "}
                      <strong>{aiSuggestion.model}</strong>, Serienr:{" "}
                      <strong>{aiSuggestion.serial}</strong>
                    </p>
                  )}
                </div>
              )}

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
                    onChange={(e) => setEventDescription(e.target.value)}
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
    </main>
  );
}
