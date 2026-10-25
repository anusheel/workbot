"use client";

import { useUIStream } from "@json-render/react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { GeneratedUI } from "./generated-ui";

const examples = [
  "An operations dashboard: open requests by team and by priority, with the latest requests in a table",
  "A form to log a vendor onboarding request for the finance team",
  "A timeline of the latest requests, newest last",
];

/** Describe a page; the model composes it from the catalog with the company's live numbers. */
export function Generator() {
  const { spec, isStreaming, error, send } = useUIStream({
    api: "/api/generate",
  });
  const [prompt, setPrompt] = useState("");
  const [asked, setAsked] = useState(false);
  const generate = (text: string) => {
    setPrompt(text);
    setAsked(true);
    void send(text, spec ? { previousSpec: spec } : undefined);
  };
  // A text stream has no channel for errors, so a reply with no page at all shows as this.
  const nothingCame = asked && !isStreaming && !error && !spec?.root;

  return (
    <div className="flex flex-col gap-8">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (prompt.trim()) generate(prompt.trim());
        }}
        className="flex flex-col gap-3"
      >
        <Textarea
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          rows={2}
          placeholder="Describe the page you want"
          aria-label="Page description"
          className="field-sizing-content"
        />
        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit" disabled={isStreaming || !prompt.trim()}>
            {isStreaming ? "Generating…" : "Generate"}
          </Button>
          {examples.map((example) => (
            <Button
              key={example}
              type="button"
              variant="outline"
              size="sm"
              onClick={() => generate(example)}
              disabled={isStreaming}
              className="rounded-full font-normal"
            >
              {example.split(":")[0].split(",")[0]}
            </Button>
          ))}
        </div>
      </form>
      {error && <p className="text-sm text-destructive">{error.message}</p>}
      {nothingCame && (
        <p className="text-sm text-muted-foreground">
          No page came back. Try again in a moment.
        </p>
      )}
      <GeneratedUI spec={spec} loading={isStreaming} />
    </div>
  );
}
