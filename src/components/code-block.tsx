"use client";

import { type ComponentProps, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

/** A code block with a copy button; the text is read from the rendered block, so highlighting does not get in the way. */
export function CodeBlock({
  node: _node,
  ...props
}: ComponentProps<"pre"> & { node?: unknown }) {
  const block = useRef<HTMLPreElement>(null);
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(block.current?.textContent ?? "");
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div className="group relative">
      <pre ref={block} {...props} />
      <Button
        type="button"
        size="xs"
        variant="outline"
        onClick={copy}
        className="absolute top-2 right-2 opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100"
      >
        {copied ? "Copied" : "Copy"}
      </Button>
    </div>
  );
}
