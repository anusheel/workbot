# The single-tenant option: one customer's own project, database, keys and
# services, from the same root as every other environment.
project           = "workbot-harbor-dental"
environment       = "production"
customer          = "harbor-dental"
domain            = "harbor-dental.workbot.example.com"
high_availability = true
min_instances     = 1
