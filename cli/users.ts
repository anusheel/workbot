import { stdin } from "node:process";
import { text } from "node:stream/consumers";
import { parseArgs } from "node:util";
import { createUser, issueKey, listUsers, revokeKey, roles } from "@/lib/auth";
import {
  providers,
  reseal,
  revokeCredential,
  saveCredential,
} from "@/lib/credentials";
import { close } from "@/lib/db";

const usage = `Usage: pnpm users <command>

  add <name> --role viewer|agent|admin   a person or a service, and its first key
  key <name>                             another key; the old ones keep working until revoked
  revoke <name>                          every key the user holds, and with them every session
  list                                   users, roles and keys (the last 4 characters of each)
  connect <name> github                  seals the token read from stdin as the user's own
  disconnect <name> github               deletes the user's sealed token
  reseal                                 seals every token again under SECRETS_KEY, so the previous key can go

A key is printed once. The terminal runs as the operator, who holds the
database itself, so it is how the first admin is made.`;

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    role: { type: "string" },
    help: { type: "boolean", default: false },
  },
});
const [command, ...rest] = positionals;
const name = rest.join(" ").trim();

async function userNamed(name: string) {
  const user = (await listUsers()).find((u) => u.name === name);
  if (!user) throw new Error(`No user named "${name}"`);
  return user;
}

if (values.help || !command) {
  console.log(usage);
  process.exit(values.help ? 0 : 1);
} else if (command === "add") {
  const role = roles.find((r) => r === values.role);
  if (!name || !role) throw new Error("add <name> --role viewer|agent|admin");
  const { user, key } = await createUser(name, role);
  console.log(`${user.name} (${user.role}): ${key}`);
} else if (command === "key") {
  const user = await userNamed(name);
  console.log(`${user.name} (${user.role}): ${await issueKey(user.id)}`);
} else if (command === "revoke") {
  const user = await userNamed(name);
  const live = user.keys.filter((k) => !k.revokedAt);
  for (const key of live) await revokeKey(key.id);
  console.log(`${user.name}: ${live.length} key(s) revoked`);
} else if (command === "connect" || command === "disconnect") {
  const provider = providers.find((p) => p === rest.at(-1));
  if (!provider) throw new Error(`${command} <name> ${providers.join("|")}`);
  const user = await userNamed(rest.slice(0, -1).join(" "));
  if (command === "disconnect") await revokeCredential(user.id, provider);
  else {
    const token = (await text(stdin)).trim();
    if (!token) throw new Error(`Pipe the ${provider} token in on stdin`);
    await saveCredential(user.id, provider, token);
  }
  console.log(`${user.name}: ${provider} ${command}ed`);
} else if (command === "reseal") {
  console.log(`${await reseal()} token(s) sealed again under the current key`);
} else if (command === "list") {
  for (const user of await listUsers())
    console.log(
      `${user.name} (${user.role}): ${user.keys.map((k) => `…${k.hint}${k.revokedAt ? " revoked" : ""}`).join(", ") || "no keys"}`,
    );
} else {
  console.log(usage);
  process.exit(1);
}
await close();
