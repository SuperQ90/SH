// src/pages/admin/PaymentsAdmin.tsx
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type PaymentRow = {
  id?: number | string;
  stripe_session_id: string | null;
  customer_email: string | null;
  amount: number | null;
  currency: string | null;
  payment_status: string | null;
  metadata: any;
  created_at: string | null;
};

export default function PaymentsAdmin() {
  const [rows, setRows] = useState<PaymentRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      // we don't know exactly what columns vibe-coder created, so we select * and normalize in UI
      const { data, error } = await supabase
        .from("payments")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);

      if (error) {
        console.error("admin load payments error", error);
        setRows([]);
        setLoading(false);
        return;
      }

      setRows(data as PaymentRow[]);
      setLoading(false);
    };

    void load();
  }, []);

  return (
    <div>
      <h2 className="text-lg font-semibold mb-4">Payments</h2>
      {loading ? (
        <p className="text-slate-300">Loading...</p>
      ) : rows.length === 0 ? (
        <p className="text-slate-400 text-sm">No payments recorded yet.</p>
      ) : (
        <div className="border border-slate-800 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-900">
              <tr>
                <th className="text-left px-4 py-2">Created</th>
                <th className="text-left px-4 py-2">Email</th>
                <th className="text-left px-4 py-2">Amount</th>
                <th className="text-left px-4 py-2">Status</th>
                <th className="text-left px-4 py-2">Session</th>
                <th className="text-left px-4 py-2">Metadata</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, idx) => (
                <tr key={r.id ?? r.stripe_session_id ?? idx} className="border-t border-slate-800">
                  <td className="px-4 py-2">
                    {r.created_at ? new Date(r.created_at).toLocaleString() : "—"}
                  </td>
                  <td className="px-4 py-2">{r.customer_email || "—"}</td>
                  <td className="px-4 py-2">
                    {r.amount
                      ? `${(r.amount / 100).toFixed(2)} ${r.currency?.toUpperCase() ?? ""}`
                      : "—"}
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className={
                        r.payment_status === "completed" || r.payment_status === "paid"
                          ? "text-green-300"
                          : r.payment_status === "requires_payment_method"
                          ? "text-amber-300"
                          : "text-slate-200"
                      }
                    >
                      {r.payment_status || "—"}
                    </span>
                  </td>
                  <td className="px-4 py-2 font-mono text-xs">
                    {r.stripe_session_id || "—"}
                  </td>
                  <td className="px-4 py-2">
                    {r.metadata
                      ? typeof r.metadata === "string"
                        ? r.metadata
                        : JSON.stringify(r.metadata)
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs text-slate-500 mt-3">
        This is data saved by the Supabase edge function <code>stripe-webhook</code>. If Stripe can't reach
        your function or the secret is wrong, this table will stay empty.
      </p>
    </div>
  );
}