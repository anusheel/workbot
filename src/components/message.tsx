import {
  type DynamicToolUIPart,
  type ToolUIPart,
  type UIMessage,
  getToolName,
  isToolUIPart,
} from "ai";
import { Markdown } from "./markdown";

export function Message({ message }: { message: UIMessage }) {
  if (message.role === "user") {
    const text = message.parts
      .map((part) => (part.type === "text" ? part.text : ""))
      .join("");
    return (
      <div className="ml-auto max-w-[85%] rounded-2xl bg-muted px-4 py-2.5 text-sm whitespace-pre-wrap">
        {text}
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-3 text-sm">
      {message.parts.map((part, index) =>
        part.type === "text" ? (
          <Markdown key={index}>{part.text}</Markdown>
        ) : isToolUIPart(part) ? (
          <ToolCall key={index} part={part} />
        ) : null,
      )}
    </div>
  );
}

const summary = (input: unknown) =>
  typeof input === "object" && input
    ? Object.values(input).map(String).join(" ").slice(0, 80)
    : "";

function ToolCall({ part }: { part: ToolUIPart | DynamicToolUIPart }) {
  const name = getToolName(part);
  const running =
    part.state === "input-streaming" || part.state === "input-available";
  const label = running
    ? `Running ${name}`
    : part.state === "output-error"
      ? `${name} failed`
      : name;
  return (
    <details className="rounded-lg border text-xs">
      <summary className="flex cursor-pointer items-center gap-2 px-3 py-2 text-muted-foreground">
        {running && (
          <span
            className="size-1.5 animate-pulse rounded-full bg-foreground/60"
            aria-hidden
          />
        )}
        <span className="font-medium text-foreground">{label}</span>
        <span className="truncate">{summary(part.input)}</span>
      </summary>
      <pre className="border-t px-3 py-2 whitespace-pre-wrap">
        {part.state === "output-available"
          ? String(part.output)
          : part.state === "output-error"
            ? part.errorText
            : JSON.stringify(part.input, null, 2)}
      </pre>
    </details>
  );
}
