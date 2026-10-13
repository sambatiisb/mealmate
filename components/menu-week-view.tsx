"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { approveMenuAction, proposeEditAction } from "@/app/actions/menu";
import { ShareMenuButton } from "@/components/share-menu-button";

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export interface MenuItemView {
  id: string;
  day: number;
  meal: "lunch" | "dinner";
  edited: boolean;
  dish: { id: string; name: string };
  companionDish: { id: string; name: string } | null;
  priority1Dish: { id: string; name: string } | null;
  priority2Dish: { id: string; name: string } | null;
}

export function MenuWeekView({
  quadId,
  quadName,
  menuId,
  status,
  items,
  needsMyApproval,
}: {
  quadId: string;
  quadName: string;
  menuId: string;
  status: string;
  items: MenuItemView[];
  needsMyApproval: boolean;
}) {
  const [selected, setSelected] = useState<MenuItemView | null>(null);
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const gridRef = useRef<HTMLDivElement>(null);

  const itemsByDay = (day: number) => ({
    lunch: items.find((i) => i.day === day && i.meal === "lunch"),
    dinner: items.find((i) => i.day === day && i.meal === "dinner"),
  });

  return (
    <>
      {status === "pending" && needsMyApproval && (
        <div className="card">
          <span className="card-kicker">Needs your vote</span>
          <div style={{ fontWeight: 800, fontSize: 17, marginBottom: 10 }}>Approve this week&apos;s menu?</div>
          <div style={{ display: "flex", gap: "var(--space-2)" }}>
            <button
              type="button"
              className="btn btn-primary"
              disabled={pending}
              onClick={() => startTransition(async () => { await approveMenuAction(menuId, true); router.refresh(); })}
            >
              Approve
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              disabled={pending}
              onClick={() => startTransition(async () => { await approveMenuAction(menuId, false); router.refresh(); })}
            >
              Reject
            </button>
          </div>
        </div>
      )}

      <div ref={gridRef} className="card" style={{ padding: 0, overflow: "hidden" }}>
        {DAY_LABELS.map((label, day) => {
          const { lunch, dinner } = itemsByDay(day);
          return (
            <div
              key={day}
              style={{
                display: "grid",
                gridTemplateColumns: "56px 1fr 1fr",
                gap: 10,
                padding: "14px 20px",
                borderBottom: day < 6 ? "1px solid var(--border-hairline)" : "none",
                alignItems: "center",
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--color-muted)" }}>{label}</div>
              <MealCell item={lunch} onClick={() => lunch && setSelected(lunch)} />
              <MealCell item={dinner} onClick={() => dinner && setSelected(dinner)} />
            </div>
          );
        })}
      </div>

      <ShareMenuButton targetRef={gridRef} quadName={quadName} />

      {selected && (
        <MealDetailDialog
          quadId={quadId}
          menuId={menuId}
          item={selected}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  );
}

function MealCell({ item, onClick }: { item: MenuItemView | undefined; onClick: () => void }) {
  if (!item) {
    return <div style={{ padding: "10px 12px" }} />;
  }
  return (
    <div
      onClick={onClick}
      style={{
        cursor: "pointer",
        padding: "10px 12px",
        borderRadius: 12,
        background: item.edited ? "var(--color-purple-pale-bg)" : "var(--color-row-bg)",
        display: "flex",
        flexDirection: "column",
        gap: 2,
      }}
    >
      <span style={{ fontSize: 10.5, fontWeight: 700, color: "var(--color-muted)", textTransform: "uppercase" }}>
        {item.meal}
      </span>
      <span style={{ fontSize: 13.5, fontWeight: 600 }}>
        {(item.priority1Dish ?? item.dish).name}
        {item.companionDish && ` + ${item.companionDish.name}`}
      </span>
      {item.edited && <span style={{ fontSize: 10, fontWeight: 700, color: "var(--color-purple)" }}>Pending approval</span>}
    </div>
  );
}

function MealDetailDialog({
  quadId,
  menuId,
  item,
  onClose,
}: {
  quadId: string;
  menuId: string;
  item: MenuItemView;
  onClose: () => void;
}) {
  const [proposing, setProposing] = useState(false);
  const [dishes, setDishes] = useState<{ id: string; name: string }[]>([]);
  const [proposedDishId, setProposedDishId] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  async function startPropose() {
    setProposing(true);
    const res = await fetch(`/api/dishes/search?${new URLSearchParams({ quadId }).toString()}`);
    if (res.ok) {
      const data = await res.json();
      setDishes(data.dishes ?? []);
    }
  }

  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div className="card-kicker" style={{ margin: 0 }}>
              {DAY_LABELS[item.day]} · {item.meal === "lunch" ? "Lunch" : "Dinner"}
            </div>
            <div style={{ fontSize: 20, fontWeight: 800 }}>
              {(item.priority1Dish ?? item.dish).name}
              {item.companionDish && ` + ${item.companionDish.name}`}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{ background: "var(--color-bg)", border: "none", borderRadius: 10, width: 32, height: 32, cursor: "pointer", fontWeight: 700 }}
          >
            ×
          </button>
        </div>

        {item.edited && (
          <div className="note-purple" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <strong>Edit proposed — awaiting quad approval</strong>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5 }}>
              <span>Priority 1 (new)</span>
              <strong>{(item.priority1Dish ?? item.dish).name}</strong>
            </div>
            {item.priority2Dish && (
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5 }}>
                <span>Priority 2 (fallback)</span>
                <strong>{item.priority2Dish.name}</strong>
              </div>
            )}
            <div style={{ fontSize: 12 }}>
              If priority 1&apos;s ingredients aren&apos;t available, the cook uses their
              judgment and makes priority 2.
            </div>
            <button
              type="button"
              className="btn btn-primary"
              disabled={pending}
              onClick={() => startTransition(async () => { await approveMenuAction(menuId, true); router.refresh(); onClose(); })}
            >
              I approve
            </button>
          </div>
        )}

        {!item.edited && !proposing && (
          <button type="button" className="btn btn-secondary" onClick={startPropose}>
            Propose a swap
          </button>
        )}

        {!item.edited && proposing && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ fontSize: 13, fontWeight: 700 }}>Propose a new dish</div>
            <select className="input" value={proposedDishId} onChange={(e) => setProposedDishId(e.target.value)}>
              <option value="">Select a dish…</option>
              {dishes.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
            <button
              type="button"
              className="btn btn-primary"
              disabled={!proposedDishId || pending}
              onClick={() =>
                startTransition(async () => {
                  await proposeEditAction(item.id, proposedDishId);
                  router.refresh();
                  onClose();
                })
              }
            >
              Submit proposal to quad
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
