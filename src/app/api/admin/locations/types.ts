// Generated from content/entities/location.json by pnpm generate. Edit the description, not this file.
import { z } from "zod";
import { Location, NewLocation } from "@/lib/entities/location";

export { NewLocation as LocationBody };

export const LocationResponse = Location.extend({
  createdAt: z.iso.datetime(),
});
export type LocationResponse = z.infer<typeof LocationResponse>;
