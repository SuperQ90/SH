import { supabase } from "@/lib/supabase";

export type MessageReportStatus =
  | "pending"
  | "reviewed"
  | "action_taken"
  | "dismissed";

export type MessageReport = {
  id: string;
  reporter_user_id: string;
  reporter_email: string | null;
  reported_user_id: string;
  reported_email: string | null;
  message_id: string | null;
  thread_id: string | null;
  reason: string;
  details: string | null;
  status: MessageReportStatus;
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
};

export const REPORT_REASONS = [
  "Harassment or bullying",
  "Spam or scam",
  "Inappropriate content",
  "Impersonation",
  "Other",
] as const;

export async function submitMessageReport(
  messageId: string,
  reason: string,
  details?: string
): Promise<string> {
  const { data, error } = await supabase.rpc("submit_message_report", {
    p_message_id: messageId,
    p_reason: reason,
    p_details: details ?? null,
  });
  if (error) throw error;
  if (!data) throw new Error("Report was not submitted");
  return String(data);
}

export async function submitConversationReport(
  threadId: string,
  reason: string,
  details?: string
): Promise<string> {
  const { data, error } = await supabase.rpc("submit_conversation_report", {
    p_thread_id: threadId,
    p_reason: reason,
    p_details: details ?? null,
  });
  if (error) throw error;
  if (!data) throw new Error("Report was not submitted");
  return String(data);
}

export async function adminListMessageReports(
  status?: MessageReportStatus | null
): Promise<MessageReport[]> {
  const { data, error } = await supabase.rpc("admin_list_message_reports", {
    p_status: status ?? null,
  });
  if (error) throw error;
  return (data ?? []) as MessageReport[];
}

export async function adminResolveMessageReport(
  reportId: string,
  status: MessageReportStatus,
  adminNotes?: string
): Promise<void> {
  const { error } = await supabase.rpc("admin_resolve_message_report", {
    p_report_id: reportId,
    p_status: status,
    p_admin_notes: adminNotes ?? null,
  });
  if (error) throw error;
}

export const REPORT_STATUS_LABELS: Record<MessageReportStatus, string> = {
  pending: "Pending",
  reviewed: "Reviewed",
  action_taken: "Action taken",
  dismissed: "Dismissed",
};
