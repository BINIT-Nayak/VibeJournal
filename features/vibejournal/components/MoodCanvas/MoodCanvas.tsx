"use client";

import { useEffect, useRef } from "react";
import type { MoodEntry } from "@/lib/mood";

type MoodCanvasProps = {
  entries: MoodEntry[];
  compact?: boolean;
  showEnergy?: boolean;
};

export function MoodCanvas({ entries, compact = false, showEnergy = false }: MoodCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.floor(rect.width * dpr);
    canvas.height = Math.floor(rect.height * dpr);

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, rect.width, rect.height);

    const padding = compact ? 12 : 28;
    const width = rect.width - padding * 2;
    const height = rect.height - padding * 2;

    ctx.strokeStyle = "rgba(31, 41, 55, 0.14)";
    ctx.lineWidth = 1;

    for (let i = 0; i <= 4; i += 1) {
      const y = padding + (height / 4) * i;
      ctx.beginPath();
      ctx.moveTo(padding, y);
      ctx.lineTo(rect.width - padding, y);
      ctx.stroke();
    }

    if (entries.length === 0) {
      ctx.fillStyle = "#6b7280";
      ctx.font = `${compact ? 12 : 14}px system-ui, sans-serif`;
      ctx.fillText("Your mood trend will draw itself here.", padding, rect.height / 2);
      return;
    }

    const points = entries
      .slice()
      .reverse()
      .slice(-14)
      .map((entry, index, list) => {
        const x = padding + (list.length === 1 ? width / 2 : (width / (list.length - 1)) * index);
        const y = padding + height - (entry.valence / 10) * height;
        return { x, y, energy: entry.energy };
      });

    const gradient = ctx.createLinearGradient(padding, 0, rect.width - padding, 0);
    gradient.addColorStop(0, "#46a6a0");
    gradient.addColorStop(0.5, "#f7b731");
    gradient.addColorStop(1, "#d85b4a");

    ctx.strokeStyle = gradient;
    ctx.lineWidth = 3;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.beginPath();
    points.forEach((point, index) => {
      if (index === 0) {
        ctx.moveTo(point.x, point.y);
      } else {
        ctx.lineTo(point.x, point.y);
      }
    });
    ctx.stroke();

    if (showEnergy) {
      ctx.strokeStyle = "rgba(47, 125, 122, 0.8)";
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      entries
        .slice()
        .reverse()
        .slice(-14)
        .forEach((entry, index, list) => {
          const x = padding + (list.length === 1 ? width / 2 : (width / (list.length - 1)) * index);
          const y = padding + height - (entry.energy / 10) * height;
          if (index === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        });
      ctx.stroke();
      ctx.setLineDash([]);
    }

    points.forEach((point) => {
      ctx.beginPath();
      ctx.fillStyle = "#ffffff";
      ctx.arc(point.x, point.y, 4 + point.energy * 0.35, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#1f2937";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    });

    ctx.fillStyle = "#475569";
    ctx.font = "12px system-ui, sans-serif";
    if (!compact) {
      ctx.fillText("low", 4, rect.height - padding + 4);
      ctx.fillText("high", 4, padding + 4);
    }
  }, [compact, entries, showEnergy]);

  return <canvas ref={canvasRef} aria-label="Mood valence trend chart" />;
}
