import { Resend } from "resend";

export type Email = { to: string; subject: string; text: string };

/**
 * Sends an email through Resend when RESEND_API_KEY is set, otherwise logs it
 * to the console so local development never needs an email account.
 */
export async function sendEmail(email: Email): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM ?? "Hyrabostad <no-reply@hyrabostad.se>";
  if (!key) {
    console.log(`\n[email] to: ${email.to}\n[email] subject: ${email.subject}\n${email.text}\n`);
    return;
  }
  const resend = new Resend(key);
  const { error } = await resend.emails.send({ from, to: email.to, subject: email.subject, text: email.text });
  if (error) throw new Error(`email send failed: ${error.message}`);
}
