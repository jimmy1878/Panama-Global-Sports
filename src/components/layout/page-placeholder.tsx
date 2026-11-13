/** Marcador temporal para rutas que aún no se construyen. */
export function PagePlaceholder({ title }: { title: string }) {
  return (
    <section>
      <h1 className="text-2xl font-bold md:text-3xl">{title}</h1>
      <p className="mt-2 text-muted">Próximamente.</p>
    </section>
  );
}
