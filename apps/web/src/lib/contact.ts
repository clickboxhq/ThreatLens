import { createServerFn } from "@tanstack/react-start";

export type ContactFormInput = {
  name: string;
  email: string;
  organization: string;
  message: string;
};

export type ContactFormResult = { ok: true };

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Validates and records a "Let's Talk" inquiry.
 *
 * TODO(backend): this only logs server-side right now -- it does not yet
 * reach info@useclickbox.com. Wire this handler to a real transactional
 * email provider (e.g. Resend's HTTP API via a RESEND_API_KEY env var) or
 * a CRM webhook before relying on it for real inquiries.
 */
export const submitContactForm = createServerFn({ method: "POST" })
  .validator((data: ContactFormInput) => {
    const name = data.name?.trim() ?? "";
    const email = data.email?.trim() ?? "";
    const organization = data.organization?.trim() ?? "";
    const message = data.message?.trim() ?? "";

    if (!name) throw new Error("Enter your name.");
    if (!email || !isValidEmail(email)) throw new Error("Enter a valid work email.");
    if (!message || message.length < 10) {
      throw new Error("Tell us a little more about what you're looking to do.");
    }

    return { name, email, organization, message };
  })
  .handler(async ({ data }): Promise<ContactFormResult> => {
    console.log("[contact-form] New inquiry for info@useclickbox.com", {
      ...data,
      receivedAt: new Date().toISOString(),
    });

    return { ok: true };
  });
