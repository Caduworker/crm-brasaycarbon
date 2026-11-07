-- Menú digital público: permite que cualquier visitante (sin iniciar sesión) LEA la carta.
-- Solo lectura de categorías y de platos activos. No expone ninguna otra tabla.

drop policy if exists "categorias_publico" on public.categorias;
create policy "categorias_publico" on public.categorias
  for select to anon using (true);

drop policy if exists "productos_publico" on public.productos;
create policy "productos_publico" on public.productos
  for select to anon using (activo = true);
