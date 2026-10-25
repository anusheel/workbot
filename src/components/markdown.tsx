import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import { CodeBlock } from "./code-block";

const components = { pre: CodeBlock };
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
