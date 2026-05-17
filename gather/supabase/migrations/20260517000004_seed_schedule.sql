with day_rows(day_date, label, short_label) as (
  values
    ('2026-06-22', 'Monday Jun 22', 'Mon 22'),
    ('2026-06-23', 'Tuesday Jun 23', 'Tue 23'),
    ('2026-06-24', 'Wednesday Jun 24', 'Wed 24'),
    ('2026-06-25', 'Thursday Jun 25', 'Thu 25'),
    ('2026-06-26', 'Friday Jun 26', 'Fri 26'),
    ('2026-06-27', 'Saturday Jun 27 - Departure Day', 'Sat 27')
),
upserted_days as (
  insert into public.schedule_days (day_date, label, short_label)
  select day_date, label, short_label
  from day_rows
  on conflict (day_date) do update
    set label = excluded.label,
        short_label = excluded.short_label,
        updated_at = now()
  returning id, day_date
),
item_rows(day_date, item_order, time, title, note) as (
  values
    ('2026-06-22', 1, '9:30 AM', 'Brunch', null),
    ('2026-06-22', 2, null, 'Hangout / free time', 'On your own'),
    ('2026-06-22', 3, null, 'Lunch', 'On your own'),
    ('2026-06-22', 4, '2:00 PM', 'Group activity', null),
    ('2026-06-22', 5, '5:30 PM', 'Supper', null),
    ('2026-06-22', 6, '8:15 PM', 'Devo time', null),
    ('2026-06-22', 7, '9:30 PM', 'Hang out, games, or bed', null),

    ('2026-06-23', 1, '9:30 AM', 'Brunch', null),
    ('2026-06-23', 2, null, 'Hangout / free time', 'On your own'),
    ('2026-06-23', 3, null, 'Lunch', 'On your own'),
    ('2026-06-23', 4, '2:00 PM', 'Group activity', null),
    ('2026-06-23', 5, '5:30 PM', 'Supper', null),
    ('2026-06-23', 6, '8:15 PM', 'Devo time', null),
    ('2026-06-23', 7, '9:30 PM', 'Hang out, games, or bed', null),

    ('2026-06-24', 1, '9:30 AM', 'Brunch', null),
    ('2026-06-24', 2, null, 'Hangout / free time', 'On your own'),
    ('2026-06-24', 3, null, 'Lunch', 'On your own'),
    ('2026-06-24', 4, '2:00 PM', 'Group activity', null),
    ('2026-06-24', 5, '5:30 PM', 'Supper', null),
    ('2026-06-24', 6, '8:15 PM', 'Devo time', null),
    ('2026-06-24', 7, '9:30 PM', 'Hang out, games, or bed', null),

    ('2026-06-25', 1, '9:30 AM', 'Brunch', null),
    ('2026-06-25', 2, null, 'Hangout / free time', 'On your own'),
    ('2026-06-25', 3, null, 'Lunch', 'On your own'),
    ('2026-06-25', 4, '2:00 PM', 'Group activity', null),
    ('2026-06-25', 5, '5:30 PM', 'Supper', null),
    ('2026-06-25', 6, '8:15 PM', 'Devo time', null),
    ('2026-06-25', 7, '9:30 PM', 'Hang out, games, or bed', null),

    ('2026-06-26', 1, '9:30 AM', 'Brunch', null),
    ('2026-06-26', 2, null, 'Hangout / free time', 'On your own'),
    ('2026-06-26', 3, null, 'Lunch', 'On your own'),
    ('2026-06-26', 4, '2:00 PM', 'Group activity', null),
    ('2026-06-26', 5, '5:30 PM', 'Supper', null),
    ('2026-06-26', 6, '8:15 PM', 'Devo time', null),
    ('2026-06-26', 7, '9:30 PM', 'Hang out, games, or bed', null),

    ('2026-06-27', 1, null, 'Breakfast items available', null),
    ('2026-06-27', 2, null, 'Sandwich supplies available', 'Make food for your trip or eat before you go')
)
insert into public.schedule_items (schedule_day_id, item_order, time, title, note)
select upserted_days.id, item_rows.item_order, item_rows.time, item_rows.title, item_rows.note
from item_rows
join upserted_days on upserted_days.day_date = item_rows.day_date
on conflict (schedule_day_id, item_order) do update
  set time = excluded.time,
      title = excluded.title,
      note = excluded.note,
      updated_at = now();