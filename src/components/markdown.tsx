import type { ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import { CodeBlock } from "./code-block";

// Model text can carry untrusted page content, and an <img> would send data out to any host.
const components = {
  pre: CodeBlock,
  img: ({ alt }: { alt?: string }) => <span>{alt}</span>,
  a: ({ href, children }: { href?: string; children?: ReactNode }) => (
    <a href={href} rel="noopener noreferrer nofollow">
      {children}
    </a>
  ),
};
const plugins = [rehypeHighlight];

/** Markdown as the app styles it, with highlighted code blocks that can be copied. */
export function Markdown({ children }: { children: string }) {
  return (
    <div className="prose prose-sm prose-neutral max-w-none">
      <ReactMarkdown rehypePlugins={plugins} components={components}>
        {children}
      </ReactMarkdown>
    </div>
  );
}
