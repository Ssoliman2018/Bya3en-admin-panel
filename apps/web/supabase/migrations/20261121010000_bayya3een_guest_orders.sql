/*
 * Bayya3een | بياعين — Guest checkout from customer mobile (anon insert/select)
 * Tighten later with customer accounts / order lookup tokens.
 */

grant insert, select on public.orders to anon;
grant insert, select on public.order_items to anon;

drop policy if exists orders_anon_insert on public.orders;
create policy orders_anon_insert
  on public.orders for insert
  to anon
  with check (true);

drop policy if exists orders_anon_select on public.orders;
create policy orders_anon_select
  on public.orders for select
  to anon
  using (true);

drop policy if exists order_items_anon_insert on public.order_items;
create policy order_items_anon_insert
  on public.order_items for insert
  to anon
  with check (true);

drop policy if exists order_items_anon_select on public.order_items;
create policy order_items_anon_select
  on public.order_items for select
  to anon
  using (true);
