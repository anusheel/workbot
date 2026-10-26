# Channels

One assistant on the web, SMS, WhatsApp and Slack, with one store of conversations. What each channel needs, how a person on two channels becomes one person, and what was proven without the providers' accounts. The code is `src/lib/channels.ts` (the turn on any channel), `src/lib/history.ts` (the store), `src/lib/twilio.ts` and `src/lib/outbound.ts` (SMS and WhatsApp), `src/lib/bot.ts` and `src/lib/chat-state.ts` (Slack).

## One agent, several adapters

Each channel's adapter turns what arrives into one shape, `{ channel, address, text, thread }`, and hands it to `respond`, which takes the same turn the web chat takes (`prepare` in `src/lib/assistant.ts`: the versioned prompt, what is known about the person, the conversation compacted to a budget) with the tools the person's role reaches. Only two things differ by channel: a line telling the model how the channel wants a reply written, and `render`, which enforces it on what comes back.

| Channel  | Arrives as                                                                         | Reply                                                            | Limits                          |
| -------- | ---------------------------------------------------------------------------------- | ---------------------------------------------------------------- | ------------------------------- |
| Web      | `POST /api/chat`, streamed                                                         | markdown, tool calls shown                                       | none                            |
| SMS      | Twilio's webhook, `POST /api/webhooks/twilio`                                      | through the workflow and the Messaging API                       | plain text, 1,600 characters    |
| WhatsApp | the same webhook, the sender prefixed `whatsapp:`                                  | the same, inside the 24-hour window or with an approved template | `*bold*` only, 4,096 characters |
| Slack    | the Chat SDK's webhook, `POST /api/webhooks/slack`                                 | a post in the thread, a card when tools were used                | the thread is the conversation  |
| iMessage | not built: no public API; Apple Messages for Business through an approved provider | the SMS channel is the fallback                                  |                                 |

## One store, one person

Conversations live on the server (`conversations`), each message marked with the channel it came by. The web chat keeps a copy in the browser for its list, but the server's copy is the conversation: a web turn starts from it, so a reply sent on WhatsApp since the browser last looked is part of the next answer, and the page fetches it to show it.

A person is linked across channels only by possession, never by a matching name or number. The web page offers a one-time code (8 characters from an alphabet without look-alikes, 10 minutes, stored as its hash); sending `link <code>` from a phone proves the sender holds both the browser session and the phone, and the phone's address then continues that conversation. Employees link Slack the same way from their settings, and WorkBot then answers them in Slack with their role. An address that never linked is a person of its own, `whatsapp:+1…`, with a conversation of its own and the customer's tools.

## SMS and WhatsApp through Twilio

- **Inbound.** Twilio signs each request: HMAC-SHA1 of the full URL followed by every parameter, name then value, sorted by name, under the account's auth token. The route checks it against the public URL (`APP_URL`), since behind a proxy the server sees another, hands the message to the workflow under Twilio's message id and answers with empty TwiML at once. A redelivery of the same message is the same workflow run.
- **The workflow** (`src/inngest/channel-reply.ts`): the turn, the reply queued in `outbound`, the send, then learning from the exchange, each a step. A step that already ran is not run again on a retry.
- **Outbound.** One call to the Messaging API, with a status callback. A message that has the provider's id is never sent again, so a retried step does not repeat it. The one gap is a failure between Twilio accepting a message and its id being stored, after which a retry sends it again; closing it means checking Twilio's list of recent messages before resending, the reconciliation `docs/integrations.md` describes for tickets. A 429 or a 5xx is recorded and retried with backoff; anything else (an invalid number, a closed window) fails the message for good with the provider's code. Twilio's status reports (`sent`, `delivered`, `undelivered`, `failed`) update the row; the Channels page shows each message's last word.
- **WhatsApp's rules.** A business may write freely for 24 hours after the customer's last message; after that, only an approved template (`TWILIO_WHATSAPP_TEMPLATE`, a Content SID, sent without variables). Without one, the message fails with that reason rather than being sent and refused. Writing first needs the customer's opt-in, which nothing here collects: WorkBot only answers people who wrote.
- **Consent.** STOP, UNSUBSCRIBE, CANCEL, END or QUIT silences an address until START; nothing is sent to it meanwhile. It silences that address, not every channel of a linked person. Twilio enforces the same for SMS on its side.

## Slack through the Chat SDK

The Chat SDK checks Slack's signature, answers within Slack's 3 seconds, drops a redelivered event and runs the handler after the response. A mention starts a thread the bot follows; each later message in the thread continues the conversation. A reply that used tools goes as a card naming them; on another platform the SDK renders the same card in that platform's form, which is the point of the SDK.

The SDK keeps state: the threads it follows, a lock per thread, keys that drop duplicate deliveries, queues. Its own Postgres adapter connects with its own driver and creates its own tables, which would sit outside the tenant policies of `docs/security.md`. `src/lib/chat-state.ts` implements the same interface over one table of WorkBot's (`chat_state`), each operation a single statement, so the bot's state is separated by tenant like every other row.

Going live needs a Slack app installed in the workspace, with this manifest and the two values in the environment:

```yaml
display_information:
  name: WorkBot
features:
  bot_user:
    display_name: WorkBot
oauth_config:
  scopes:
    bot:
      [
        app_mentions:read,
        channels:history,
        groups:history,
        chat:write,
        users:read,
      ]
settings:
  event_subscriptions:
    request_url: https://<your app>/api/webhooks/slack
    bot_events: [app_mention, message.channels, message.groups]
```

## A person, when the assistant cannot help

`hand_off` is offered on every channel: it files a request for the team that looks after customers, with the conversation so far, the reason, and where to reply ("Reply on WhatsApp to +1…"). On SMS and WhatsApp an unlinked sender is a customer, and the assistant is told so: answer from the customer-facing documents, do not send them to an internal team, hand off when they need a person.

That note is not given on the web. The first version gave it to everyone signed in as no one, and the chat eval's smoke set fell from 0.94 to 0.80: its cases expect the web assistant to name the team or the approver, because it was written for employees who had not signed in. Who the signed-out web visitor is, an employee or a customer, is a product decision, and the eval holds it until someone makes it.

## What was proven, and how

| Claim                                                                                                               | How                                                                                                                                           |
| ------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| A web conversation continues on WhatsApp with its context, and the web shows the WhatsApp turns                     | Live on the dev server: a visitor's chat, a code, then deliveries signed as Twilio signs them; real model turns; tests                        |
| A refused or unsigned webhook does nothing                                                                          | Route tests: a wrong token, no signature, a changed body                                                                                      |
| A send with its id stored is not repeated, a provider failure retries and reports, a bad number fails with its code | Tests against a stand-in for the Messaging API on the machine                                                                                 |
| WhatsApp's window holds: free text inside 24 hours, the template or nothing after                                   | Tests, the same stand-in                                                                                                                      |
| Slack: the signature, the URL check, a thread as a conversation, cards                                              | Route tests on the SDK's handler; the handler tested with a thread object                                                                     |
| A hand-off reaches a person with the transcript and is not filed twice                                              | Live: two hand-offs on WhatsApp; tests. The live run found the first version, which kept only a reply's text, filing a hand-off a second time |

No Twilio account and no Slack workspace were available, so no message left the machine: every live reply is in `outbound` as failed with "no Twilio account is configured". Going live needs the account and the numbers in the environment, the webhook URLs set in Twilio's console (`/api/webhooks/twilio` for messages, the status callback is sent with each message), a WhatsApp sender approved by Meta, and for Slack the app above.

## What is not here

- iMessage. Business messaging runs through Apple Messages for Business and an approved provider; SMS is the fallback, with sender rules that vary by country and number type.
- Template variables, opt-in collection for WhatsApp, and a page or alert when a hand-off arrives: it waits in the team's requests.
- Quiet hours, typing indicators, and attachments (photos of damaged goods would be the first to add).
- Teams, Google Chat and Discord: each is an adapter in the same bot, with its own app to register.
- A person replying from WorkBot to the channel a hand-off came from; today they reply in the channel's own console.
- Email, which stays on the document workflow.
