alter table app_private.facility_reports
  drop constraint if exists facility_reports_content_check;

alter table app_private.facility_reports
  add constraint facility_reports_content_check
  check (length(btrim(content)) between 0 and 8192);
