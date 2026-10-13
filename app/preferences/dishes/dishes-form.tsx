"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveDishesAction, setVegOnlyAction, type PrefActionState } from "@/app/actions/preferences";
import { addCustomDishAction } from "@/app/actions/dishes";
import { MIN_DISHES_REQUIRED } from "@/lib/constants";

const initialState: PrefActionState = {};

interface DishOption {
  id: string;
  name: string;
  cuisine: string;
  subcategory: string | null;
  isVeg: boolean;
  foodType: string;
  imageUrl: string;
  containsFlags: string[];
}

export function DishesForm({
  quadId,
  menuCategories,
  initialDishes,
  initialVegOnly,
}: {
  quadId: string;
  menuCategories: string[];
  initialDishes: DishOption[];
  initialVegOnly: boolean;
}) {
  const [state, formAction, pending] = useActionState(saveDishesAction, initialState);
  const router = useRouter();

  // veg-only toggle (saved per-user)
  const [vegOnly, setVegOnly] = useState(initialVegOnly);
  const [savingVegOnly, startVegOnlyTransition] = useTransition();

  function toggleVegOnly(val: boolean) {
    setVegOnly(val);
    startVegOnlyTransition(async () => {
      await setVegOnlyAction(val);
    });
  }

  // cascading filter state — Level 1 browses by menuCategory (meal type: Rice,
  // Breads, Curries…), which is more intuitive to browse than region-style
  // cuisine. The scoring algorithm still weights by dish.cuisine underneath,
  // untouched — this only changes what students click through to find dishes.
  const [activeMenuCategory, setActiveMenuCategory] = useState(menuCategories[0] ?? "");
  const [activeSubcat, setActiveSubcat] = useState("All");
  const [results, setResults] = useState<DishOption[]>([]);

  // selection state — cumulative across all navigation changes (§4.2)
  const [selected, setSelected] = useState<DishOption[]>(initialDishes);
  const selectedIds = new Set(selected.map((d) => d.id));

  // custom dish form
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customName, setCustomName] = useState("");
  const [addingCustom, setAddingCustom] = useState(false);

  // load subcategories for the active menu category
  const [subcats, setSubcats] = useState<string[]>([]);
  useEffect(() => {
    async function loadSubcats() {
      const params = new URLSearchParams({ quadId, menuCategory: activeMenuCategory, vegOnly: String(vegOnly) });
      const res = await fetch(`/api/dishes/search?${params}`);
      if (!res.ok) return;
      const data = await res.json();
      const seen = new Set<string>();
      const cats: string[] = [];
      for (const d of data.dishes as DishOption[]) {
        if (d.subcategory && !seen.has(d.subcategory)) {
          seen.add(d.subcategory);
          cats.push(d.subcategory);
        }
      }
      setSubcats(cats.sort());
      setActiveSubcat("All");
    }
    if (activeMenuCategory) loadSubcats();
  }, [activeMenuCategory, vegOnly, quadId]);

  // load dishes whenever menu category/subcat/vegOnly changes
  useEffect(() => {
    async function loadDishes() {
      const params = new URLSearchParams({
        quadId,
        menuCategory: activeMenuCategory,
        vegOnly: String(vegOnly),
        ...(activeSubcat !== "All" ? { subcategory: activeSubcat } : {}),
      });
      const res = await fetch(`/api/dishes/search?${params}`);
      if (!res.ok) return;
      const data = await res.json();
      setResults(data.dishes ?? []);
    }
    if (activeMenuCategory) loadDishes();
  }, [activeMenuCategory, activeSubcat, vegOnly, quadId]);

  function toggleDish(dish: DishOption) {
    setSelected((prev) =>
      selectedIds.has(dish.id) ? prev.filter((d) => d.id !== dish.id) : [...prev, dish]
    );
  }

  async function handleAddCustom() {
    if (!customName.trim()) return;
    setAddingCustom(true);
    try {
      const dish = await addCustomDishAction({
        quadId,
        name: customName.trim(),
        cuisine: activeMenuCategory,
        foodType: vegOnly ? "veg" : "nonveg",
      });
      setSelected((prev) => [...prev, dish]);
      setCustomName("");
      setShowCustomForm(false);
    } finally {
      setAddingCustom(false);
    }
  }

  const showLevel2 = subcats.length >= 2;
  const carouselRef = useRef<HTMLDivElement>(null);
  function scrollCarousel(dir: -1 | 1) {
    carouselRef.current?.scrollBy({ left: dir * 160, behavior: "smooth" });
  }

  return (
    <>
      <div>
        <h6>Preferences · pick your dishes</h6>
        <h2>What do you like to eat?</h2>
        <p className="text-muted" style={{ margin: 0 }}>Browse by category, pick dishes. Your selections are saved as you go.</p>
      </div>

      {/* Veg-only toggle — asked before browsing (§5.1) */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: "var(--color-bg)",
          borderRadius: 14,
          padding: "12px 16px",
        }}
      >
        <div>
          <div style={{ fontWeight: 700, fontSize: 14 }}>Vegetarian only</div>
          <div className="text-muted" style={{ fontSize: 12 }}>Hides all non-veg dishes for you</div>
        </div>
        <button
          type="button"
          onClick={() => toggleVegOnly(!vegOnly)}
          disabled={savingVegOnly}
          style={{
            width: 44,
            height: 26,
            borderRadius: 13,
            background: vegOnly ? "var(--color-accent)" : "var(--border-input)",
            border: "none",
            cursor: "pointer",
            position: "relative",
            transition: "background 0.2s",
            flexShrink: 0,
          }}
          aria-label={vegOnly ? "Disable veg-only" : "Enable veg-only"}
        >
          <span
            style={{
              position: "absolute",
              top: 3,
              left: vegOnly ? 22 : 3,
              width: 20,
              height: 20,
              borderRadius: "50%",
              background: "#fff",
              transition: "left 0.2s",
            }}
          />
        </button>
      </div>

      {/* Level 1 — menu category carousel, with chevrons since horizontal
          scroll alone isn't discoverable */}
      <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 4 }}>
        <button
          type="button"
          onClick={() => scrollCarousel(-1)}
          aria-label="Scroll categories left"
          style={{
            flexShrink: 0,
            width: 28,
            height: 28,
            borderRadius: "50%",
            border: "1px solid var(--border-input)",
            background: "#fff",
            cursor: "pointer",
          }}
        >
          ‹
        </button>
        <div ref={carouselRef} style={{ overflowX: "auto", display: "flex", gap: 8, paddingBottom: 4, scrollBehavior: "smooth" }}>
          {menuCategories.map((c) => (
            <button
              key={c}
              type="button"
              className="chip"
              data-selected={c === activeMenuCategory}
              onClick={() => setActiveMenuCategory(c)}
              style={{ flexShrink: 0 }}
            >
              {c}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => scrollCarousel(1)}
          aria-label="Scroll categories right"
          style={{
            flexShrink: 0,
            width: 28,
            height: 28,
            borderRadius: "50%",
            border: "1px solid var(--border-input)",
            background: "#fff",
            cursor: "pointer",
          }}
        >
          ›
        </button>
      </div>

      {/* Level 2 — subcategory chips (only when ≥2 subcategories exist) */}
      {showLevel2 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {["All", ...subcats].map((sc) => (
            <button
              key={sc}
              type="button"
              className="chip"
              data-selected={sc === activeSubcat}
              onClick={() => setActiveSubcat(sc)}
            >
              {sc}
            </button>
          ))}
        </div>
      )}

      {/* Selection counter */}
      <div style={{ fontSize: 13, fontWeight: 600 }}>
        <span style={{ color: selected.length >= MIN_DISHES_REQUIRED ? "var(--color-accent)" : "var(--color-error)" }}>
          {selected.length}
        </span>
        <span className="text-muted"> of {MIN_DISHES_REQUIRED} minimum selected, across all categories</span>
      </div>

      {/* Level 3 — dish grid */}
      <div className="grid-dishes" style={{ maxHeight: 360, overflowY: "auto", paddingRight: 4 }}>
        {results.map((dish) => {
          const isSelected = selectedIds.has(dish.id);
          return (
            <div
              key={dish.id}
              onClick={() => toggleDish(dish)}
              style={{
                cursor: "pointer",
                borderRadius: 16,
                overflow: "hidden",
                border: `2px solid ${isSelected ? "var(--color-accent)" : "rgba(0,0,0,0.08)"}`,
                background: "#fff",
                display: "flex",
                flexDirection: "column",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={dish.imageUrl} alt="" style={{ width: "100%", height: 88, objectFit: "cover" }} />
              <div style={{ padding: "8px 10px", display: "flex", flexDirection: "column", gap: 2 }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, lineHeight: 1.2 }}>{dish.name}</div>
                <div className="text-muted" style={{ fontSize: 10.5 }}>
                  {dish.subcategory ?? dish.cuisine}
                </div>
              </div>
            </div>
          );
        })}
        {results.length === 0 && activeMenuCategory && (
          <p className="text-muted" style={{ fontSize: 13, margin: 0, gridColumn: "1/-1" }}>
            No dishes found — try a different filter or add a custom dish below.
          </p>
        )}
      </div>

      {/* Custom dish */}
      {showCustomForm ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, background: "var(--color-bg)", borderRadius: 14, padding: 14 }}>
          <input
            className="input"
            placeholder="Dish name"
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
          />
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" className="btn btn-ghost" onClick={() => setShowCustomForm(false)}>
              Cancel
            </button>
            <button type="button" className="btn btn-primary" disabled={addingCustom || !customName.trim()} onClick={handleAddCustom}>
              {addingCustom ? "Adding…" : "Add"}
            </button>
          </div>
          <div className="text-muted" style={{ fontSize: 11 }}>Stays private to your quad only.</div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowCustomForm(true)}
          style={{
            background: "none",
            border: "1.5px dashed rgba(0,0,0,0.2)",
            borderRadius: 12,
            padding: 12,
            fontSize: 13,
            fontWeight: 600,
            color: "var(--color-muted)",
            cursor: "pointer",
          }}
        >
          + Can&apos;t find it? Add a custom dish
        </button>
      )}

      {/* Selected dishes summary */}
      {selected.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {selected.map((d) => (
            <span key={d.id} className="tag" style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
              {d.name}
              <button
                type="button"
                onClick={() => toggleDish(d)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "inherit", padding: 0, fontWeight: 700 }}
                aria-label={`Remove ${d.name}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      <form
        action={formAction}
        style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6 }}
      >
        <input type="hidden" name="quadId" value={quadId} />
        <input type="hidden" name="dishIds" value={selected.map((d) => d.id).join(",")} />
        <button type="button" className="btn btn-ghost" onClick={() => router.back()}>
          Back
        </button>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
          {state.error && <p style={{ color: "var(--color-error)", fontSize: 13, margin: 0 }}>{state.error}</p>}
          <button type="submit" className="btn btn-primary" disabled={pending || selected.length < MIN_DISHES_REQUIRED}>
            {pending ? "Saving…" : "Continue"}
          </button>
        </div>
      </form>
    </>
  );
}
