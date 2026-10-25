import { close } from "@/lib/db";
import { embedder } from "@/lib/embeddings";
import { indexKnowledge } from "@/lib/knowledge";

const embed = embedder();
const count = await indexKnowledge(embed);
console.log(
  `${count} sections indexed${embed ? " with embeddings" : ", by words only (no VOYAGE_API_KEY)"}.`,
);
await close();
