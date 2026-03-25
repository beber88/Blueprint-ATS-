import twilio from "twilio";

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

export async function sendWhatsApp(
  to: string,
  body: string
): Promise<string> {
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
    from: process.env.TWILIO_WHATSAPP_FROM || "whatsapp:+14155238886",
    to: `whatsapp:${formattedTo}`,
    body,
  });

  return message.sid;
}
