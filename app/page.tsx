"use client";

import React, { FormEvent, useEffect, useMemo, useState, ChangeEvent } from "react";
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
  machine_id: string;
  event_type: string;
  description: string;
  created_at: string;
  previous_hash: string | null;
  hash: string | null;
};

type MachineType = "wheel_loader" | "excavator";

type Valuation = {
  estimated_value: number;
  confidence: number;
  comment: string | null;
};

type Condition = {
  condition_score: number;
  condition_label: string;
  notes: string;
  risk_flags: string[];
};

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
const toNumOrNull = (v: string) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

export default function Home() {
  // ---------- global ----------
  const [error, setError] = useState<string | null>(null);
const [newMachineImageUrl, setNewMachineImageUrl] = useState<string | null>(null);
const [uploadingNewMachineImage, setUploadingNewMachineImage] = useState(false);

  // ---------- machines ----------
  const [machines, setMachines] = useState<Machine[]>([]);
  const [loadingMachines, setLoadingMachines] = useState(true);
  const [selectedMachine, setSelectedMachine] = useState<Machine | null>(null);

  // add machine form
  const [mName, setMName] = useState("");
  const [mModel, setMModel] = useState("");
  const [mSerial, setMSerial] = useState("");
  const [mYear, setMYear] = useState<string>("");
  const [mHours, setMHours] = useState<string>("");
  const [savingMachine, setSavingMachine] = useState(false);

  // add machine image (AI-first optional)
  const [uploadingNewMachineImage, setUploadingNewMachineImage] = useState(false);
  const [newMachineImageUrl, setNewMachineImageUrl] = useState<string | null>(null);
  const [loadingNewMachineAi, setLoadingNewMachineAi] = useState(false);

  // ---------- events ----------
  const [events, setEvents] = useState<MachineEvent[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);

  const [eventType, setEventType] = useState<"service" | "owner_change" | "note">("service");
  const [eventDescription, setEventDescription] = useState("");
  const [savingEvent, setSavingEvent] = useState(false);

  // verify chain
  const [verifying, setVerifying] = useState(false);
  const [verifyMessage, setVerifyMessage] = useState<string | null>(null);
  const [verifyOk, setVerifyOk] = useState<boolean | null>(null);

  // ---------- AI (selected machine) ----------
  const [valuation, setValuation] = useState<Valuation | null>(null);
  const [loadingValuation, setLoadingValuation] = useState(false);

  const [condition, setCondition] = useState<Condition | null>(null);
  const [loadingCondition, setLoadingCondition] = useState(false);

  // ---------- leads ----------
  const [machineType, setMachineType] = useState<MachineType>("wheel_loader");

  const [leadSubmitting, setLeadSubmitting] = useState(false);
  const [leadSent, setLeadSent] = useState(false);
  const [leadError, setLeadError] = useState<string | null>(null);

  // lead basics
  const [leadName, setLeadName] = useState("");
  const [leadEmail, setLeadEmail] = useState("");
  const [leadPhone, setLeadPhone] = useState("");
  const [leadMessage, setLeadMessage] = useState("");

  // common machine fields (lead)
  const [brand, setBrand] = useState("");
  const [leadModel, setLeadModel] = useState("");
  const [leadYear, setLeadYear] = useState<string>("");
  const [leadHours, setLeadHours] = useState<string>("");
  const [locationText, setLocationText] = useState("");
  const [valueEstimate, setValueEstimate] = useState<string>("");
  const [conditionScore, setConditionScore] = useState<string>("");

  // excavator extras
  const [exWeightClass, setExWeightClass] = useState<string>("");
  const [exUndercarriage, setExUndercarriage] = useState<string>("");
  const [exTracksType, setExTracksType] = useState<string>("steel");
  const [exQuickCoupler, setExQuickCoupler] = useState<boolean>(true);
  const [exRototilt, setExRototilt] = useState<boolean>(false);
  const [exBucketSize, setExBucketSize] = useState<string>("");
  const [exExtraHydraulics, setExExtraHydraulics] = useState<boolean>(false);

  // excavator estimate (optional)
  const [estimateLow, setEstimateLow] = useState<string>("");
  const [estimateHigh, setEstimateHigh] = useState<string>("");
  const [estimateNote, setEstimateNote] = useState<string>("");

  // wheel loader extras
  const [wlWeightClass, setWlWeightClass] = useState<string>("");
  const [wlBucketSize, setWlBucketSize] = useState<string>("");
  const [wlTirePercent, setWlTirePercent] = useState<string>("");
  const [wlArticulationPlay, setWlArticulationPlay] = useState<boolean>(false);

  const [wlQuickCoupler, setWlQuickCoupler] = useState<boolean>(true);
  const [wlThirdFunction, setWlThirdFunction] = useState<boolean>(false);
  const [wlCentralLube, setWlCentralLube] = useState<boolean>(false);
  const [wlWeighingSystem, setWlWeighingSystem] = useState<boolean>(false);
  const [wlRearCamera, setWlRearCamera] = useState<boolean>(false);

  const [wlTransmission, setWlTransmission] = useState<string>("powershift");
  const [wlLeakage, setWlLeakage] = useState<string>("none");
  const [wlTireType, setWlTireType] = useState<string>("industrial");

  // wheel loader estimate (optional)
  const [wlEstimateLow, setWlEstimateLow] = useState<string>("");
  const [wlEstimateHigh, setWlEstimateHigh] = useState<string>("");
  const [wlEstimateNote, setWlEstimateNote] = useState<string>("");

  // ---------- Pro scores ----------
  const wheelLoaderProScore = useMemo(() => {
    let score = 0;

    if (wlQuickCoupler) score += 2;
    if (wlThirdFunction) score += 2;
    if (wlCentralLube) score += 1;
    if (wlWeighingSystem) score += 1;
    if (wlRearCamera) score += 1;

    if (!wlArticulationPlay) score += 1;

    if (wlLeakage === "none") score += 1;
    else if (wlLeakage === "much") score -= 1;

    const tire = wlTirePercent ? Number(wlTirePercent) : NaN;
    if (Number.isFinite(tire)) {
      if (tire >= 70) score += 1;
      else if (tire < 40) score -= 1;
    }

    return clamp(score, 0, 10);
  }, [
    wlQuickCoupler,
    wlThirdFunction,
    wlCentralLube,
    wlWeighingSystem,
    wlRearCamera,
    wlArticulationPlay,
    wlLeakage,
    wlTirePercent,
  ]);

  const wheelLoaderProLabel = useMemo(() => {
    if (wheelLoaderProScore >= 8) return "TOP SPEC 🔥";
    if (wheelLoaderProScore >= 5) return "Bra spec ✅";
    if (wheelLoaderProScore >= 3) return "Standard";
    return "Bas / osäkert";
  }, [wheelLoaderProScore]);

  const excavatorProScore = useMemo(() => {
    let score = 0;

    if (exQuickCoupler) score += 2;
    if (exRototilt) score += 3;
    if (exExtraHydraulics) score += 1;

    const uc = exUndercarriage ? Number(exUndercarriage) : NaN;
    if (Number.isFinite(uc)) {
      if (uc >= 80) score += 2;
      else if (uc >= 60) score += 1;
      else if (uc < 40) score -= 1;
    }

    if (exTracksType === "steel") score += 1;

    const bucket = exBucketSize ? Number(exBucketSize) : NaN;
    if (Number.isFinite(bucket)) {
      if (bucket >= 800) score += 1;
    }

    if (exWeightClass && exWeightClass.trim().length > 0) score += 1;

    return clamp(score, 0, 10);
  }, [
    exQuickCoupler,
    exRototilt,
    exExtraHydraulics,
    exUndercarriage,
    exTracksType,
    exBucketSize,
    exWeightClass,
  ]);

  const excavatorProLabel = useMemo(() => {
    if (excavatorProScore >= 8) return "TOP SPEC 🔥";
    if (excavatorProScore >= 5) return "Bra spec ✅";
    if (excavatorProScore >= 3) return "Standard";
    return "Bas / osäkert";
  }, [excavatorProScore]);

  // ---------- API: machines ----------
  const fetchMachines = async () => {
    setLoadingMachines(true);
    setError(null);

    try {
      const res = await fetch("/api/machines", { cache: "no-store" });
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

    try {
      const res = await fetch(
        `/api/machines/events?machineId=${encodeURIComponent(machineId)}`,
        { cache: "no-store" }
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
    setVerifyMessage(null);
    setVerifyOk(null);
    setValuation(null);
    setCondition(null);
    fetchEvents(m.id);
  };

  // ---------- Add machine (with optional image_url) ----------
 const handleNewMachineImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (!file) return;

  setError(null);
  setUploadingNewMachineImage(true);

  try {
    const filePath = `new/${Date.now()}-${file.name}`;

    const { error: uploadError } = await supabase.storage
      .from("machine-images")
      .upload(filePath, file);

    if (uploadError) throw uploadError;

    const { data: publicData } = supabase.storage
      .from("machine-images")
      .getPublicUrl(filePath);

    const publicUrl = publicData.publicUrl;

    setNewMachineImageUrl(publicUrl); // <-- VIKTIG
  } catch (err: any) {
    console.error(err);
    setError("Kunde inte ladda upp bild.");
  } finally {
    setUploadingNewMachineImage(false);
  }
};


  const handleNewMachineAi = async () => {
    if (!newMachineImageUrl) {
      setError("Ladda upp bild först.");
      return;
    }

    setError(null);
    setLoadingNewMachineAi(true);

    try {
      const res = await fetch("/api/ai-scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl: newMachineImageUrl }),
      });

      const text = await res.text();
      let json: any;
      try {
        json = JSON.parse(text);
      } catch {
        throw new Error("AI-backend gav inte JSON.");
      }

      if (!res.ok) throw new Error(json.error || "AI-scan misslyckades.");

      const modelFromAi = json.model || "";
      const serialFromAi = json.serial || "";

      if (modelFromAi) {
        setMModel(modelFromAi);
        if (!mName) setMName(modelFromAi);
      }
      if (serialFromAi) setMSerial(serialFromAi);
    } catch (e: any) {
      console.error(e);
      setError(e?.message || "AI-scan misslyckades.");
    } finally {
      setLoadingNewMachineAi(false);
    }
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
    const yearNum = mYear.trim() ? Number(mYear) : null;
    const hoursNum = mHours.trim() ? Number(mHours) : null;

    const payload = {
      name: mName,
      model: mModel,
      serial_number: mSerial,
      year: yearNum !== null && Number.isFinite(yearNum) ? yearNum : null,
      hours: hoursNum !== null && Number.isFinite(hoursNum) ? hoursNum : null,
      image_url: newMachineImageUrl ?? null,
    };

    console.log("CREATE machine payload", payload);

    const res = await fetch("/api/machines/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const json = await res.json();
    console.log("CREATE response", json);

    if (!json.ok) throw new Error(json.error || "Kunde inte spara maskin.");

    if (json.machine) {
      setMachines((prev) => [json.machine, ...prev]);
    } else {
      await fetchMachines();
    }

    // reset form
    setMName("");
    setMModel("");
    setMSerial("");
    setMYear("");
    setMHours("");
    // valfritt: reset bild för ny maskin
    setNewMachineImageUrl(null);
  } catch (err: any) {
    console.error(err);
    setError(err?.message || "Kunde inte spara maskin.");
  } finally {
    setSavingMachine(false);
  }
};


  // ---------- Events: create + verify (API) ----------
  const handleAddEvent = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!selectedMachine) return setError("Välj en maskin först.");
    if (!eventDescription.trim()) return setError("Skriv en beskrivning för händelsen.");

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
    if (!selectedMachine) return setError("Välj en maskin först.");

    setVerifying(true);
    setVerifyMessage("Verifierar kedja...");
    setVerifyOk(null);

    try {
      const res = await fetch(
        `/api/machines/events/verify?machineId=${encodeURIComponent(selectedMachine.id)}`,
        { cache: "no-store" }
      );
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "Kunde inte verifiera kedjan.");

      setVerifyOk(!!json.verified);
      setVerifyMessage(
        json.message || (json.verified ? "Kedjan är intakt ✅" : "Kedjan är bruten ❌")
      );
    } catch (err: any) {
      console.error(err);
      setVerifyOk(false);
      setVerifyMessage(null);
      setError(err?.message || "Kunde inte verifiera kedjan.");
    } finally {
      setVerifying(false);
    }
  };

  // ---------- AI: valuation + condition (API) ----------
  const handleValuation = async () => {
    if (!selectedMachine) return setError("Välj en maskin först.");

    setError(null);
    setLoadingValuation(true);
    setValuation(null);

    try {
      const res = await fetch("/api/valuation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          machineId: selectedMachine.id,
          model: selectedMachine.model,
          year: selectedMachine.year,
          hours: selectedMachine.hours,
          conditionScore: condition?.condition_score ?? null,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Kunde inte beräkna värde.");

      setValuation({
        estimated_value: json.estimated_value,
        confidence: json.confidence,
        comment: json.comment ?? null,
      });
    } catch (e: any) {
      console.error(e);
      setError(e?.message || "Värdering misslyckades.");
    } finally {
      setLoadingValuation(false);
    }
  };

  const handleCondition = async () => {
    if (!selectedMachine?.image_url) return setError("Maskinen behöver en bild först.");

    setError(null);
    setLoadingCondition(true);
    setCondition(null);

    try {
      const res = await fetch("/api/condition", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl: selectedMachine.image_url }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Kunde inte bedöma skick.");

      setCondition({
        condition_score: json.condition_score,
        condition_label: json.condition_label,
        notes: json.notes,
        risk_flags: json.risk_flags ?? [],
      });
    } catch (e: any) {
      console.error(e);
      setError(e?.message || "AI-skick misslyckades.");
    } finally {
      setLoadingCondition(false);
    }
  };

  // ---------- Lead payload ----------
  const leadPayload = useMemo(() => {
    const base = {
      name: leadName.trim(),
      email: leadEmail.trim(),
      phone: leadPhone.trim() || null,
      message: leadMessage.trim() || null,

      brand: brand.trim() || null,
      model: leadModel.trim() || null,
      year: leadYear ? toNumOrNull(leadYear) : null,
      hours: leadHours ? toNumOrNull(leadHours) : null,
      locationText: locationText.trim() || null,

      valueEstimate: valueEstimate ? toNumOrNull(valueEstimate) : null,
      conditionScore: conditionScore ? toNumOrNull(conditionScore) : null,
    };

    if (machineType === "wheel_loader") {
      return {
        ...base,
        machine_type: "wheel_loader",
        machine_payload: {
          weight_class: wlWeightClass || null,
          bucket_size_liters: wlBucketSize ? toNumOrNull(wlBucketSize) : null,
          tire_percent: wlTirePercent ? toNumOrNull(wlTirePercent) : null,
          articulation_play: wlArticulationPlay,

          quick_coupler: wlQuickCoupler,
          third_function: wlThirdFunction,
          central_lube: wlCentralLube,
          weighing_system: wlWeighingSystem,
          rear_camera: wlRearCamera,

          transmission: wlTransmission,
          leakage: wlLeakage,
          tire_type: wlTireType,

          pro_score: wheelLoaderProScore,
          pro_label: wheelLoaderProLabel,
        },
        estimate_low: wlEstimateLow ? toNumOrNull(wlEstimateLow) : null,
        estimate_high: wlEstimateHigh ? toNumOrNull(wlEstimateHigh) : null,
        estimate_note: wlEstimateNote.trim() || null,
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

        pro_score: excavatorProScore,
        pro_label: excavatorProLabel,
      },
      estimate_low: estimateLow ? toNumOrNull(estimateLow) : null,
      estimate_high: estimateHigh ? toNumOrNull(estimateHigh) : null,
      estimate_note: estimateNote.trim() || null,
    };
  }, [
    leadName,
    leadEmail,
    leadPhone,
    leadMessage,
    brand,
    leadModel,
    leadYear,
    leadHours,
    locationText,
    valueEstimate,
    conditionScore,
    machineType,

    // WL
    wlWeightClass,
    wlBucketSize,
    wlTirePercent,
    wlArticulationPlay,
    wlQuickCoupler,
    wlThirdFunction,
    wlCentralLube,
    wlWeighingSystem,
    wlRearCamera,
    wlTransmission,
    wlLeakage,
    wlTireType,
    wlEstimateLow,
    wlEstimateHigh,
    wlEstimateNote,
    wheelLoaderProScore,
    wheelLoaderProLabel,

    // EX
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
    excavatorProScore,
    excavatorProLabel,
  ]);

  const handleLeadSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLeadSubmitting(true);
    setLeadSent(false);
    setLeadError(null);

    try {
      if (!leadPayload.email) throw new Error("E-post krävs.");

      const res = await fetch("/api/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(leadPayload),
      });

      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "Kunde inte skicka förfrågan.");

      setLeadSent(true);

      // reset basics
      setLeadName("");
      setLeadEmail("");
      setLeadPhone("");
      setLeadMessage("");

      // reset common
      setBrand("");
      setLeadModel("");
      setLeadYear("");
      setLeadHours("");
      setLocationText("");
      setValueEstimate("");
      setConditionScore("");

      // reset WL
      setWlWeightClass("");
      setWlBucketSize("");
      setWlTirePercent("");
      setWlArticulationPlay(false);
      setWlQuickCoupler(true);
      setWlThirdFunction(false);
      setWlCentralLube(false);
      setWlWeighingSystem(false);
      setWlRearCamera(false);
      setWlTransmission("powershift");
      setWlLeakage("none");
      setWlTireType("industrial");
      setWlEstimateLow("");
      setWlEstimateHigh("");
      setWlEstimateNote("");

      // reset EX
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

  const activeProScore = machineType === "wheel_loader" ? wheelLoaderProScore : excavatorProScore;
  const activeProLabel = machineType === "wheel_loader" ? wheelLoaderProLabel : excavatorProLabel;

  // ---------- UI ----------
  return (
    <main className="min-h-screen flex flex-col items-center p-6 gap-8 bg-slate-50">
      <header className="w-full max-w-5xl">
        <h1 className="text-3xl font-bold text-center">Arctic Trace – MVP</h1>
        <p className="text-sm text-gray-600 mt-2 text-center">
          Maskiner, historik, AI & värderings-leads. Allt på samma sida. ✅
        </p>
      </header>

      {error && <p className="text-sm text-red-500">{error}</p>}

      {/* MACHINES */}
      <section className="w-full max-w-5xl grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left */}
        <div className="bg-white shadow-md rounded-xl p-6">
          <h2 className="text-xl font-semibold mb-3">Lägg till maskin</h2>
{/* NY MASKIN – BILD */}
<div className="mb-4">
  <p className="text-sm font-semibold mb-1">Bild (valfritt)</p>

  <input
    type="file"
    accept="image/*"
    onChange={handleNewMachineImageChange}
    className="text-sm"
  />

  {uploadingNewMachineImage && (
    <p className="text-xs text-gray-500 mt-1">Laddar upp bild...</p>
  )}

  {newMachineImageUrl ? (
    <div className="mt-3 border rounded-lg p-3 bg-emerald-50">
      <p className="text-sm font-semibold text-emerald-800">Bild kopplad ✅</p>
      <img
        src={newMachineImageUrl}
        alt="Ny maskin-bild"
        className="mt-2 w-full max-h-48 object-cover rounded-md border"
      />
      <button
        type="button"
        onClick={() => setNewMachineImageUrl(null)}
        className="mt-2 text-xs px-3 py-1 rounded border border-emerald-300 bg-white"
      >
        Ta bort bild
      </button>
    </div>
  ) : (
    <p className="text-xs text-gray-500 mt-2">Ingen bild vald ännu.</p>
  )}
</div>

          {/* AI-first image */}
          <div className="mb-4 border rounded-lg p-3 bg-slate-50">
            <p className="text-sm font-semibold mb-2">Bild (valfritt)</p>
            <input type="file" accept="image/*" onChange={handleNewMachineImageChange} className="text-sm" />
            {uploadingNewMachineImage && <p className="text-xs text-gray-500 mt-1">Laddar upp bild...</p>}
            {newMachineImageUrl && <p className="text-xs text-emerald-600 mt-1">Bild uppladdad ✅</p>}

            <button
              type="button"
              onClick={handleNewMachineAi}
              disabled={!newMachineImageUrl || loadingNewMachineAi}
              className="mt-2 text-xs bg-purple-600 text-white px-3 py-1 rounded disabled:opacity-60"
            >
              {loadingNewMachineAi ? "Läser av med AI..." : "🔍 AI: fyll i modell & serienr"}
            </button>
          </div>

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
                    Modell: {m.model || "-"} • År: {m.year || "-"} • Timmar: {m.hours ?? "-"}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Right */}
        <div className="bg-white shadow-md rounded-xl p-6">
          {!selectedMachine ? (
            <p>Välj en maskin till vänster för att se historik + AI.</p>
          ) : (
            <>
              <h2 className="text-xl font-semibold mb-2">Maskinpass: {selectedMachine.name}</h2>
              <p className="text-sm text-gray-600 mb-2">
                Modell: {selectedMachine.model || "-"} • Serienr: {selectedMachine.serial_number || "-"}
              </p>

              {selectedMachine.image_url && (
                <img
                  src={selectedMachine.image_url}
                  alt="Maskinbild"
                  className="w-full max-h-56 object-cover rounded-lg border mb-3"
                />
              )}

              {/* AI */}
              <div className="border rounded-lg p-3 bg-slate-50 mb-4 space-y-2">
                <p className="text-sm font-semibold">AI</p>

                <button
                  type="button"
                  onClick={handleValuation}
                  disabled={loadingValuation}
                  className="text-xs bg-slate-900 text-white px-3 py-2 rounded disabled:opacity-60 w-full"
                >
                  {loadingValuation ? "Beräknar värde..." : "🧮 Beräkna marknadsvärde"}
                </button>

                {valuation && (
                  <div className="border rounded-lg p-3 bg-amber-50">
                    <p className="text-sm font-semibold">
                      Värde: {valuation.estimated_value.toLocaleString("sv-SE")} NOK
                    </p>
                    <p className="text-xs text-gray-600">Confidence: {valuation.confidence}%</p>
                    {valuation.comment && <p className="text-xs text-gray-700 mt-1">{valuation.comment}</p>}
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleCondition}
                  disabled={loadingCondition || !selectedMachine.image_url}
                  className="text-xs bg-emerald-700 text-white px-3 py-2 rounded disabled:opacity-60 w-full"
                >
                  {loadingCondition ? "AI bedömer skick..." : "🧠 AI-bedöm skick från bild"}
                </button>

                {condition && (
                  <div className="border rounded-lg p-3 bg-emerald-50">
                    <p className="text-sm font-semibold">
                      Skick: {condition.condition_label} ({condition.condition_score}/5)
                    </p>
                    {condition.notes && <p className="text-xs text-gray-700 mt-1">{condition.notes}</p>}
                    {condition.risk_flags?.length > 0 && (
                      <p className="text-[11px] text-red-700 mt-1">Risker: {condition.risk_flags.join(", ")}</p>
                    )}
                  </div>
                )}
              </div>

              {/* ADD EVENT + VERIFY */}
              <div className="border rounded-lg p-3 bg-slate-50 mb-4">
                <h3 className="font-semibold mb-2">Lägg till händelse</h3>

                <form onSubmit={handleAddEvent} className="flex flex-col gap-2">
                  <select
                    value={eventType}
                    onChange={(e) => setEventType(e.target.value as any)}
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

                <div className="flex items-center gap-3 mt-3">
                  <button
                    type="button"
                    onClick={handleVerifyChain}
                    disabled={verifying}
                    className="text-xs bg-emerald-600 text-white px-3 py-2 rounded disabled:opacity-60"
                  >
                    {verifying ? "Verifierar..." : "Verifiera kedja"}
                  </button>

                  {verifyMessage && (
                    <span
                      className={`text-xs ${
                        verifyOk === false
                          ? "text-red-600"
                          : verifyOk === true
                          ? "text-emerald-700"
                          : "text-gray-600"
                      }`}
                    >
                      {verifyMessage}
                    </span>
                  )}
                </div>
              </div>

              {/* EVENTS */}
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
                      <p className="text-sm text-gray-700 mt-1 whitespace-pre-line">{ev.description}</p>
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
            <p className="text-sm text-gray-600">Välj maskintyp och fyll i. Sparas via /api/lead.</p>
          </div>

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

        {/* unified score row */}
        <div className="border rounded-lg p-3 bg-slate-50 mb-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">Pro score (MVP-indikator)</p>
            <span className="text-xs font-semibold px-2 py-1 rounded-full border bg-white">
              {activeProScore}/10 – {activeProLabel}
            </span>
          </div>
          <div className="h-2 w-full rounded bg-white border overflow-hidden mt-2">
            <div className="h-full bg-slate-900" style={{ width: `${activeProScore * 10}%` }} />
          </div>
        </div>

        <form onSubmit={handleLeadSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* left */}
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
                value={leadModel}
                onChange={(e) => setLeadModel(e.target.value)}
                className="border px-2 py-2 w-full rounded"
                placeholder={machineType === "excavator" ? "EC140" : "L70H"}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium">Årsmodell</label>
                <input
                  type="number"
                  value={leadYear}
                  onChange={(e) => setLeadYear(e.target.value)}
                  className="border px-2 py-2 w-full rounded"
                  placeholder="2018"
                />
              </div>
              <div>
                <label className="block text-sm font-medium">Timmar</label>
                <input
                  type="number"
                  value={leadHours}
                  onChange={(e) => setLeadHours(e.target.value)}
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

            {/* Wheel loader module */}
            {machineType === "wheel_loader" && (
              <div className="border rounded-lg p-3 bg-slate-50 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">Hjullastare – extra info</p>
                  <span className="text-xs font-semibold px-2 py-1 rounded-full border bg-white">
                    {wheelLoaderProScore}/10 – {wheelLoaderProLabel}
                  </span>
                </div>
                <div className="h-2 w-full rounded bg-white border overflow-hidden">
                  <div className="h-full bg-slate-900" style={{ width: `${wheelLoaderProScore * 10}%` }} />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium">Viktklass (t.ex. 20t)</label>
                    <input
                      value={wlWeightClass}
                      onChange={(e) => setWlWeightClass(e.target.value)}
                      className="border px-2 py-2 w-full rounded"
                      placeholder="20t"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium">Skopvolym (liter)</label>
                    <input
                      type="number"
                      value={wlBucketSize}
                      onChange={(e) => setWlBucketSize(e.target.value)}
                      className="border px-2 py-2 w-full rounded"
                      placeholder="3000"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium">Däck % kvar</label>
                    <input
                      type="number"
                      value={wlTirePercent}
                      onChange={(e) => setWlTirePercent(e.target.value)}
                      className="border px-2 py-2 w-full rounded"
                      placeholder="60"
                      min={0}
                      max={100}
                    />
                  </div>
                  <div className="flex items-center gap-2 pt-6">
                    <input
                      type="checkbox"
                      checked={wlArticulationPlay}
                      onChange={(e) => setWlArticulationPlay(e.target.checked)}
                    />
                    <span className="text-sm">Midjeglapp</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium">Transmission</label>
                    <select
                      value={wlTransmission}
                      onChange={(e) => setWlTransmission(e.target.value)}
                      className="border px-2 py-2 w-full rounded"
                    >
                      <option value="powershift">Powershift</option>
                      <option value="cvt">CVT</option>
                      <option value="hydro">Hydrostat</option>
                      <option value="unknown">Vet ej</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium">Läckage</label>
                    <select
                      value={wlLeakage}
                      onChange={(e) => setWlLeakage(e.target.value)}
                      className="border px-2 py-2 w-full rounded"
                    >
                      <option value="none">Inget</option>
                      <option value="some">Lite</option>
                      <option value="much">Mycket</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium">Däcktyp</label>
                  <select
                    value={wlTireType}
                    onChange={(e) => setWlTireType(e.target.value)}
                    className="border px-2 py-2 w-full rounded"
                  >
                    <option value="summer">Sommar</option>
                    <option value="winter">Vinter</option>
                    <option value="industrial">Industri</option>
                    <option value="chains">Kedjor</option>
                  </select>
                </div>

                <div className="flex flex-wrap gap-3 text-sm">
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={wlQuickCoupler} onChange={(e) => setWlQuickCoupler(e.target.checked)} />
                    Snabbfäste
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={wlThirdFunction} onChange={(e) => setWlThirdFunction(e.target.checked)} />
                    3:e funktion
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={wlCentralLube} onChange={(e) => setWlCentralLube(e.target.checked)} />
                    Centralsmörjning
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={wlWeighingSystem} onChange={(e) => setWlWeighingSystem(e.target.checked)} />
                    Vågsystem
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={wlRearCamera} onChange={(e) => setWlRearCamera(e.target.checked)} />
                    Backkamera
                  </label>
                </div>

                <p className="text-xs text-gray-600">(Skickas som <code>machine_payload</code>.)</p>
              </div>
            )}

            {/* Excavator module */}
            {machineType === "excavator" && (
              <div className="border rounded-lg p-3 bg-slate-50 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">Grävmaskin – extra info</p>
                  <span className="text-xs font-semibold px-2 py-1 rounded-full border bg-white">
                    {excavatorProScore}/10 – {excavatorProLabel}
                  </span>
                </div>
                <div className="h-2 w-full rounded bg-white border overflow-hidden">
                  <div className="h-full bg-slate-900" style={{ width: `${excavatorProScore * 10}%` }} />
                </div>

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
                    <input type="checkbox" checked={exRototilt} onChange={(e) => setExRototilt(e.target.checked)} />
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

                <p className="text-xs text-gray-600">(Skickas som <code>machine_payload</code>.)</p>
              </div>
            )}
          </div>

          {/* right */}
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

            {/* Wheel loader estimate */}
            {machineType === "wheel_loader" && (
              <div className="border rounded-lg p-3 bg-amber-50 space-y-3">
                <p className="text-sm font-semibold">Hjullastare – estimat (valfritt)</p>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium">Estimat low (NOK)</label>
                    <input
                      type="number"
                      value={wlEstimateLow}
                      onChange={(e) => setWlEstimateLow(e.target.value)}
                      className="border px-2 py-2 w-full rounded"
                      placeholder="650000"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium">Estimat high (NOK)</label>
                    <input
                      type="number"
                      value={wlEstimateHigh}
                      onChange={(e) => setWlEstimateHigh(e.target.value)}
                      className="border px-2 py-2 w-full rounded"
                      placeholder="850000"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium">Estimat note</label>
                  <input
                    value={wlEstimateNote}
                    onChange={(e) => setWlEstimateNote(e.target.value)}
                    className="border px-2 py-2 w-full rounded"
                    placeholder="ex: däck 60%, centralsmörjning, våg, 3:e funktion"
                  />
                </div>

                <p className="text-xs text-gray-600">
                  (Skickas som <code>estimate_low</code>, <code>estimate_high</code>, <code>estimate_note</code>.)
                </p>
              </div>
            )}

            {/* Excavator estimate */}
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
              <p className="text-xs text-emerald-600">Tack! Din förfrågan är mottagen – vi hör av oss.</p>
            )}
          </div>
        </form>
      </section>

      <footer className="text-xs text-gray-500">
        API: <code>/api/machines</code>, <code>/api/machines/create</code>,{" "}
        <code>/api/machines/events</code>, <code>/api/machines/events/create</code>,{" "}
        <code>/api/machines/events/verify</code>, <code>/api/lead</code>,{" "}
        <code>/api/valuation</code>, <code>/api/condition</code>, <code>/api/ai-scan</code>
      </footer>
    </main>
  );
}
