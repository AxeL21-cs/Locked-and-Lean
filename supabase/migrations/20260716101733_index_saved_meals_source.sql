-- Cover the composite historical-source foreign key used when source entries
-- are deleted and when saved-meal provenance is inspected.
create index saved_meals_source_entry_owner_idx
  on public.saved_meals (source_food_entry_id, user_id)
  where source_food_entry_id is not null;
