import dossier from "../../../research/dossier.json";

// The dossier as data: the question, the summary, every claim and every source.
export const GET = () => Response.json(dossier);
