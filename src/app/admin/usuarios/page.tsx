import type { Metadata } from "next";
import { PageTitle } from "@/components/ui/section";
import { getUsers } from "@/features/admin/data";
import { AdminForm, Select } from "@/features/admin/form";
import { ROLE_LABELS } from "@/lib/auth";
import { changeRole } from "./actions";

export const metadata: Metadata = { title: "Usuarios y roles" };

const ROLES = ["parent", "delegate", "admin"] as const;
const dateFmt = new Intl.DateTimeFormat("es-PA", { timeZone: "America/Panama", day: "numeric", month: "short", year: "numeric" });

export default async function UsersAdminPage() {
  const users = await getUsers();

  return (
    <div>
      <PageTitle
        title="Usuarios y roles"
        subtitle="Quien ingresa por primera vez queda como Familia. Aquí asignas Delegado/Árbitro o Administrador."
      />
      <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
        {users.map((u) => (
          <li key={u.id} className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center">
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">{u.email}</span>
              <span className="block text-xs text-muted">
                {u.full_name ? `${u.full_name} · ` : ""}desde {dateFmt.format(new Date(u.created_at))}
              </span>
            </span>
            <AdminForm action={changeRole} submitLabel="Guardar" compact className="flex items-center gap-2">
              <input type="hidden" name="user_id" value={u.id} />
              <Select name="role" defaultValue={u.role} aria-label={`Rol de ${u.email}`} className="w-48">
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </option>
                ))}
              </Select>
            </AdminForm>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-muted">
        Los delegados solo pueden cargar los partidos a los que se les asigna (en Partidos). Da el rol de administrador solo a
        personas de confianza.
      </p>
    </div>
  );
}
