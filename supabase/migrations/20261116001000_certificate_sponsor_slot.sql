-- =============================================================================
-- Migración 10 · Un espacio de patrocinio más: el certificado
--
-- El certificado es la única pieza del sitio que acaba impresa y pegada en la
-- pared de una casa, así que vale como espacio vendible. No hace falta más que
-- una fila: el catálogo de espacios existe justamente para que vender uno nuevo
-- no sea un despliegue.
--
-- El ámbito se elige al asignarlo, como cualquier otro espacio: un patrocinador
-- puede llevarse los certificados de una categoría, de un torneo o de toda la
-- organización.
-- =============================================================================

insert into public.sponsorship_slots (code, name, description, format, sort_order) values
  ('certificado', 'Certificado del jugador',
   'Pie del certificado en PDF que la familia descarga al terminar el torneo',
   'Logo mediano, se imprime', 8)
on conflict (code) do nothing;
