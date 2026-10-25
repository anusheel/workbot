// Generated from content/entities/vendor.json by pnpm generate. Edit the description, not this file.
import { z } from "zod";
import { Vendor, NewVendor } from "@/lib/entities/vendor";

export { NewVendor as VendorBody };

export const VendorResponse = Vendor.extend({ createdAt: z.iso.datetime() });
export type VendorResponse = z.infer<typeof VendorResponse>;
