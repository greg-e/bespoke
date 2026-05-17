create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.food_metadata (
  id integer primary key default 1,
  summary text not null,
  shopping_doc_url text,
  allergies text[] not null default '{}'::text[],
  kitchen_notes text[] not null default '{}'::text[],
  extra_requests text[] not null default '{}'::text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint food_metadata_singleton check (id = 1)
);

insert into public.food_metadata (
  id,
  summary,
  shopping_doc_url,
  allergies,
  kitchen_notes,
  extra_requests
)
values (
  1,
  'Brunch at 9:30, flexible lunch, family supper rotation, and team cleanup after each meal.',
  'https://docs.google.com/document/d/1u1vNgTx5i4pAgnXYzso0IJWCvlSg3Rbq9Dh0G4m6aLs/edit?usp=sharing',
  array[
    'Gluten free needs',
    'Soy limit, except in chocolate and sauces',
    'Low dairy preference',
    'Provide meat-free, protein-rich sides',
    'No peanuts, and caution around Ben'
  ],
  array[
    'Kitchen has standard pots, pans, utensils, and Blackstone grill',
    'Bring complete ingredient list for each supper assignment',
    'Include quantities, weights, and preferred brand when needed'
  ],
  array[
    'Snacks and lunch foods',
    'Drinks',
    'Salad ingredients',
    'Extras like skewer sticks or foil'
  ]
)
on conflict (id) do update
  set summary = excluded.summary,
      shopping_doc_url = excluded.shopping_doc_url,
      allergies = excluded.allergies,
      kitchen_notes = excluded.kitchen_notes,
      extra_requests = excluded.extra_requests,
      updated_at = now();

create trigger set_food_metadata_updated_at
before update on public.food_metadata
for each row execute function public.set_updated_at();