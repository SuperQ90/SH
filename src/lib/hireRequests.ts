// src/lib/hireRequests.ts
import { supabase } from "@/lib/supabase";
import { emitNotificationsChanged } from "@/lib/notifications";

export type HireRequestStatus =
  | "new"
  | "in_review"
  | "accepted"
  | "declined"
  | "completed";

export type HireRequest = {
  id: string;
  artist_user_id: string;
  requester_user_id: string;
  requester_name: string;
  requester_email: string;
  requester_phone: string | null;
  brief: string;
  budget: string | null;
  deadline: string | null;
  status: HireRequestStatus;
  created_at: string;
  updated_at: string;
};

export type SubmitHireRequestInput = {
  artistUserId: string;
  requesterName: string;
  requesterEmail: string;
  requesterPhone?: string;
  brief: string;
  budget?: string;
  deadline?: string; // YYYY-MM-DD
};

export async function submitHireRequest(
  input: SubmitHireRequestInput
): Promise<string> {
  const { data, error } = await supabase.rpc("submit_hire_request", {
    p_artist_user_id: input.artistUserId,
    p_requester_name: input.requesterName.trim(),
    p_requester_email: input.requesterEmail.trim(),
    p_requester_phone: input.requesterPhone?.trim() || null,
    p_brief: input.brief.trim(),
    p_budget: input.budget?.trim() || null,
    p_deadline: input.deadline || null,
  });

  if (error) throw error;

  const row = Array.isArray(data) ? data[0] : data;
  const id = (row as { hire_request_id?: string })?.hire_request_id;
  if (!id) {
    throw new Error("Hire request was not created");
  }

  emitNotificationsChanged();
  return id;
}

export async function listHireRequestsReceived(): Promise<HireRequest[]> {
  const { data, error } = await supabase.rpc("list_hire_requests_received");
  if (error) throw error;
  return (data ?? []) as HireRequest[];
}

export async function listHireRequestsSent(): Promise<HireRequest[]> {
  const { data, error } = await supabase.rpc("list_hire_requests_sent");
  if (error) throw error;
  return (data ?? []) as HireRequest[];
}

export async function updateHireRequestStatus(
  hireRequestId: string,
  status: HireRequestStatus
): Promise<void> {
  const { error } = await supabase.rpc("update_hire_request_status", {
    p_hire_request_id: hireRequestId,
    p_status: status,
  });
  if (error) throw error;
}

export const HIRE_STATUS_LABELS: Record<HireRequestStatus, string> = {
  new: "New",
  in_review: "In review",
  accepted: "Accepted",
  declined: "Declined",
  completed: "Completed",
};
