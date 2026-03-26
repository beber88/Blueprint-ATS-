import twilio from "twilio";

function getTwilioClient() {
  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
    throw new Error("Twilio is not configured. Set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN.");
  }
  return twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
}

export async function sendWhatsApp(
  to: string,
  body: string
): Promise<string> {
  const client = getTwilioClient();

  if (!process.env.TWILIO_WHATSAPP_FROM) {
    throw new Error("TWILIO_WHATSAPP_FROM is not configured.");
  }

  // Format phone number to international format
  let formattedTo = to.replace(/[\s\-\(\)]/g, "");
  if (!formattedTo.startsWith("+")) {
    if (formattedTo.startsWith("0")) {
      formattedTo = "+972" + formattedTo.substring(1);
    } else {
      formattedTo = "+" + formattedTo;
    }
  }

  const message = await client.messages.create({
    from: process.env.TWILIO_WHATSAPP_FROM,
    to: `whatsapp:${formattedTo}`,
    body,
  });

  return message.sid;
}
