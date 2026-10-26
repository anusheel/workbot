-- People who started each week.
select date_trunc('week', joined) as week, count(*) as people from people group by all order by week
