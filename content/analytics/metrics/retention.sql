-- Of the people who joined in a week, the share still active each week after.
with cohorts as (select person, date_trunc('week', joined) as cohort from people),
active as (select distinct person, date_trunc('week', day) as week from activity)
select cohort, datediff('week', cohort, week) as weeks_after,
       round(count(distinct a.person) / any_value(size), 3) as retained
from cohorts c join active a using (person)
join (select cohort, count(*) as size from cohorts group by cohort) s using (cohort)
group by all order by cohort, weeks_after
