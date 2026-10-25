import { Ban } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";
import { PendingButton } from "@/components/pending-button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { listUsers, requireUser } from "@/lib/auth";
import { when } from "@/lib/format";
import { disconnectUser, revoke } from "./actions";
import { AddKey, AddUser } from "./user-forms";

export const metadata: Metadata = { title: "Users" };

export default function UsersPage() {
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Users</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        People and services, each with a role and keys. A viewer reads, an agent
        also acts, an admin also administers. A key is shown once and stored as
        its hash; revoking it ends every session it opened.
      </p>
      <Suspense
        fallback={
          <p className="mt-8 text-sm text-muted-foreground">Loading…</p>
        }
      >
        <Users />
      </Suspense>
    </>
  );
}

async function Users() {
  await requireUser("admin");
  const users = await listUsers();
  const now = new Date();
  return (
    <>
      <div className="mt-8">
        <AddUser />
      </div>
      <div className="mt-6 rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Keys</TableHead>
              <TableHead>Connections</TableHead>
              <TableHead className="w-40" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.id} className="align-top">
                <TableCell className="font-medium">{user.name}</TableCell>
                <TableCell>
                  <Badge
                    variant={user.role === "admin" ? "default" : "secondary"}
                  >
                    {user.role}
                  </Badge>
                </TableCell>
                <TableCell>
                  <ul className="grid gap-2">
                    {user.keys.map((key) => (
                      <li
                        key={key.id}
                        className="flex items-center gap-3 text-sm"
                      >
                        <code className="font-mono text-xs">…{key.hint}</code>
                        <span className="text-muted-foreground">
                          {key.revokedAt
                            ? `revoked ${when(new Date(key.revokedAt), now)}`
                            : key.lastUsedAt
                              ? `used ${when(new Date(key.lastUsedAt), now)}`
                              : "never used"}
                        </span>
                        {!key.revokedAt && (
                          <form action={revoke.bind(null, key.id)}>
                            <PendingButton busy="Revoking…" icon={<Ban />}>
                              Revoke
                            </PendingButton>
                          </form>
                        )}
                      </li>
                    ))}
                  </ul>
                </TableCell>
                <TableCell>
                  {user.connections.map((provider) => (
                    <form
                      key={provider}
                      action={disconnectUser.bind(null, user.id, provider)}
                      className="flex items-center gap-2 text-sm"
                    >
                      {provider}
                      <PendingButton busy="Revoking…" icon={<Ban />}>
                        Revoke
                      </PendingButton>
                    </form>
                  ))}
                </TableCell>
                <TableCell>
                  <AddKey userId={user.id} name={user.name} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
