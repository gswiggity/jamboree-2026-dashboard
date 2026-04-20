-- Allow the uploader to update their own imports row. Needed so the
-- import Server Action can patch new_rows/updated_rows after the upsert.

create policy "uploader update imports"
  on public.imports for update to authenticated
  using (uploaded_by = auth.uid())
  with check (uploaded_by = auth.uid());
