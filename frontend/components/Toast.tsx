"use client";
import { useEffect, useState } from "react";

interface ToastProps {
  message: string;
  type?: "error" | "success";
  onClose: () => void;
}

export function Toast({ message, type = "error", onClose }: ToastProps) {
  useEffect(() => {
    const t = setTimeout(onClose, 4000);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div
      role="alert"
      style={{
        position: "fixed",
        bottom: "24px",
        left: "50%",
        transform: "translateX(-50%)",
        background: type === "error" ? "#fef2f2" : "#f0fdf4",
        border: `1.5px solid ${type === "error" ? "#fca5a5" : "#86efac"}`,
        color: type === "error" ? "#b91c1c" : "#15803d",
        borderRadius: "12px",
        padding: "12px 20px",
        fontFamily: "'Plus Jakarta Sans', sans-serif",
        fontSize: "13px",
        fontWeight: 500,
        boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        gap: "8px",
        maxWidth: "360px",
        whiteSpace: "nowrap",
      }}
    >
      <span>{type === "error" ? "⚠" : "✓"}</span>
      {message}
      <button
        onClick={onClose}
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          marginLeft: "8px",
          color: "inherit",
          opacity: 0.6,
          fontSize: "16px",
          lineHeight: 1,
          padding: 0,
        }}
        aria-label="Dismiss"
      >
        ×
      </button>
    </div>
  );
}
