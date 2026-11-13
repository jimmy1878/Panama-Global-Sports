import { Field, Select } from "./form";

export function TeamSelect({
  name,
  label,
  teams,
  defaultValue = "",
}: {
  name: string;
  label: string;
  teams: { id: string; name: string }[];
  defaultValue?: string;
}) {
  return (
    <Field name={name} label={label}>
      <Select name={name} required defaultValue={defaultValue}>
        <option value="" disabled>
          Elige un equipo
        </option>
        {teams.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </Select>
    </Field>
  );
}
