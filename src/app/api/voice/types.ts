import { z } from "zod";
import { Turns } from "@/lib/voice";

export const VoiceBody = z.object({ turns: Turns });
