import type { Metadata } from "next";
import { Suspense } from "react";
import { Conversations } from "@/components/conversations";
import type { LinkTarget } from "@/components/link-code";
import { config } from "@/lib/config";
import { customer } from "@/lib/customer";
import { linkPhone } from "./actions";

export const metadata: Metadata = { title: "Chat" };

// The numbers this deployment texts from, each a link that opens the phone's app with the code typed in.
const { smsFrom, whatsappFrom } = config.twilio;
const phone: LinkTarget[] = [
  ...(whatsappFrom
    ? [
        {
          label: "Open WhatsApp",
          href: `https://wa.me/${whatsappFrom.replace(/\D/g, "")}?text={code}`,
        },
      ]
    : []),
  ...(smsFrom
    ? [{ label: `Text ${smsFrom}`, href: `sms:${smsFrom}?&body={code}` }]
    : []),
];

export default function ChatPage() {
  return (
    <Suspense>
      <Conversations
        assistant={customer.assistant}
        phone={phone.length ? { targets: phone, link: linkPhone } : undefined}
      />
    </Suspense>
  );
}
