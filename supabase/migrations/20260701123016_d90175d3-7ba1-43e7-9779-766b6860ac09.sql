
revoke execute on function public.set_updated_at() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.apply_debt_payment() from public, anon, authenticated;
revoke execute on function public.apply_receivable_payment() from public, anon, authenticated;
-- has_role is intentionally callable by authenticated (used inside RLS policies)
revoke execute on function public.has_role(uuid, public.app_role) from public, anon;
