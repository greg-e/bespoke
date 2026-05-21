alter table public.activities
add column if not exists assignment text;

do $$
begin
  if to_regclass('public.assignments') is not null and to_regclass('public.activities') is not null then
    update public.activities as activity
    set assignment = trim(concat_ws(' - ', assignment_row.type, assignment_row.assignee))
    from public.assignments as assignment_row
    where activity.assignment is null
      and activity.assignment_id is not null
      and assignment_row.id = activity.assignment_id;
  end if;
end;
$$;
