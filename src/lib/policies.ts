import { type Document, getDocument, listDocuments } from "./knowledge";

export type Policy = Pick<
  Document,
  "slug" | "title" | "owner" | "updated" | "body"
>;

/** The policies are the knowledge base's `policies` section. */
export const listPolicies = (): Promise<Policy[]> => listDocuments("policies");

export const getPolicy = (slug: string): Promise<Policy | undefined> =>
  getDocument(`policies/${slug}`);
