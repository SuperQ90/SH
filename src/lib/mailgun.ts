import { supabase } from './supabase';

export interface EmailParams {
  to: string;
  subject: string;
  text?: string;
  html?: string;
  from?: string;
}

export async function sendEmail(params: EmailParams) {
  try {
    const { data, error } = await supabase.functions.invoke('send-email', {
      body: params
    });

    if (error) {
      throw error;
    }

    if (!data.success) {
      throw new Error(data.error || 'Failed to send email');
    }

    return data;
  } catch (error) {
    console.error('Error sending email:', error);
    throw error;
  }
}
