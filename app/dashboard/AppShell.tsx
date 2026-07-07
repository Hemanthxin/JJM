"use client";
import { useState } from "react";
import Dashboard from "./Dashboard";
import PrimaryAnalysis from "./PrimaryAnalysis";

export default function AppShell({ data }: { data: any }) {
  const [mode, setMode] = useState<"primary" | "secondary">("primary");
  return (
    <>
      <div className="modebar">
        <div className="seg modeseg">
          <button className={mode === "primary" ? "active" : ""} onClick={() => setMode("primary")}>Primary Analysis</button>
          <button className={mode === "secondary" ? "active" : ""} onClick={() => setMode("secondary")}>Secondary Analysis</button>
        </div>
        <span className="mode-hint">
          {mode === "primary"
            ? "Household survey — State / District / Division, by topic"
            : "SCSP / TSP physical & financial progress (secondary data)"}
        </span>
      </div>
      {mode === "primary" ? (
        <PrimaryAnalysis />
      ) : data ? (
        <Dashboard data={data} />
      ) : (
        <main className="dash">
          <div className="card" style={{ marginTop: 20 }}>
            <h3>No secondary data found</h3>
            <p style={{ color: "#5b6b7d" }}>
              Run <code>npm run seed</code> with your <code>DATABASE_URL</code> set to load the SCSP/TSP data.
            </p>
          </div>
        </main>
      )}
    </>
  );
}
