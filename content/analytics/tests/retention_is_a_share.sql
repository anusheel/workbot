-- Fails with rows when a cohort retains more than it had, or a negative week.
select * from {{retention}} where retained > 1 or weeks_after < 0
