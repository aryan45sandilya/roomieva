"use client";

import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef, useState } from "react";
import { cx, rupeesShort } from "@/lib/format";
import type { Listing } from "@/lib/types";
import { Icon } from "./icons";

const STYLE = process.env.NEXT_PUBLIC_MAP_STYLE_URL || "https://tiles.openfreemap.org/styles/positron";
const BENGALURU: [number, number] = [77.64, 12.93];

type Pin = Pick<Listing, "id" | "approxLat" | "approxLng" | "rent" | "title" | "locality">;

/**
 * MapLibre map with price pins.
 *
 * Pins sit on each listing's approximate coordinates (neighbourhood centre
 * plus an offset), never on the address. In `approximate` mode a single wide
 * circle is drawn instead of a pin, for the property page.
 */
export default function MapView({
  listings,
  activeId = null,
  onSelect,
  approximate = false,
  className,
}: {
  listings: Pin[];
  activeId?: string | null;
  onSelect?: (id: string | null) => void;
  approximate?: boolean;
  className?: string;
}) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const markers = useRef(new Map<string, { marker: maplibregl.Marker; el: HTMLElement }>());
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const [failed, setFailed] = useState<string | null>(null);

  useEffect(() => {
    if (!container.current) return;
    let instance: maplibregl.Map;
    try {
      instance = new maplibregl.Map({
        container: container.current,
        style: STYLE,
        center: BENGALURU,
        zoom: approximate ? 13 : 10.6,
        attributionControl: { compact: true },
        cooperativeGestures: approximate,
        dragRotate: false,
        pitchWithRotate: false,
      });
    } catch {
      setFailed("This browser can't draw the map (WebGL is unavailable). The list still has everything.");
      return;
    }
    instance.touchZoomRotate.disableRotation();
    instance.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    let styleLoaded = false;
    instance.on("load", () => (styleLoaded = true));
    instance.on("error", () => {
      if (!styleLoaded) setFailed("The map background couldn't load. Pins still show roughly where each home is.");
    });
    instance.on("click", () => onSelectRef.current?.(null));
    map.current = instance;
    const store = markers.current;
    return () => {
      store.forEach((m) => m.marker.remove());
      store.clear();
      instance.remove();
      map.current = null;
    };
  }, [approximate]);

  // Keep markers in step with the filtered listings.
  const signature = listings.map((l) => `${l.id}:${l.rent}`).join(",");
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    const wanted = new Set(listings.map((l) => l.id));
    markers.current.forEach((entry, id) => {
      if (!wanted.has(id)) {
        entry.marker.remove();
        markers.current.delete(id);
      }
    });
    for (const l of listings) {
      if (markers.current.has(l.id)) continue;
      let el: HTMLElement;
      if (approximate) {
        el = document.createElement("div");
        el.style.cssText = "width:150px;height:150px;border-radius:50%;background:rgb(255 210 31 / 0.28);border:1.5px dashed #8a5a00;pointer-events:none";
        el.setAttribute("aria-hidden", "true");
      } else {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "saha-pin";
        button.textContent = rupeesShort(l.rent);
        button.setAttribute("aria-label", `${l.title}, ${l.locality}, ${rupeesShort(l.rent)} a month`);
        button.addEventListener("click", (e) => {
          e.stopPropagation();
          onSelectRef.current?.(l.id);
        });
        button.addEventListener("mouseenter", () => onSelectRef.current?.(l.id));
        el = button;
      }
      const marker = new maplibregl.Marker({ element: el }).setLngLat([l.approxLng, l.approxLat]).addTo(m);
      markers.current.set(l.id, { marker, el });
    }
    if (listings.length === 1) {
      m.jumpTo({ center: [listings[0].approxLng, listings[0].approxLat], zoom: approximate ? 13 : 13.5 });
    } else if (listings.length > 1) {
      const bounds = new maplibregl.LngLatBounds();
      listings.forEach((l) => bounds.extend([l.approxLng, l.approxLat]));
      m.fitBounds(bounds, { padding: 64, maxZoom: 13.5, duration: 500 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, approximate]);

  // Highlight the pin that matches the hovered / selected card.
  useEffect(() => {
    markers.current.forEach((entry, id) => {
      entry.el.dataset.active = String(id === activeId);
      entry.el.style.zIndex = id === activeId ? "5" : "";
    });
  }, [activeId, signature]);

  return (
    <div className={cx("relative overflow-hidden bg-sand", className)}>
      <div ref={container} className="absolute inset-0" role="region" aria-label={approximate ? "Map showing the approximate area of this home" : "Map of homes"} />
      {failed && (
        <p className="absolute inset-x-3 top-3 z-10 flex items-start gap-2 rounded-xl bg-paper px-3 py-2 text-sm shadow-lift">
          <Icon name="alert" size={16} className="mt-0.5 shrink-0 text-clay" />
          {failed}
        </p>
      )}
    </div>
  );
}
