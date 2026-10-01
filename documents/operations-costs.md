# Operations costs

What Strategy Dance costs to run each month at 10, 100, 1,000 and 10,000 users, with the database
and the servers sized for each step.

Every unit price comes from the Cloud Billing Catalog API, read with gcloud's credentials on
2026-10-01. Usage comes from the project's own Cloud Monitoring metrics between 2026-09-23 and
2026-10-01, and from reading the code for what one user's day costs in requests. Prices are Google's
list prices in USD, before tax and without discounts. The billing account pays in EUR, at the
catalog's rate on that day: 1 USD = 0.88 EUR.

## Summary

| | 10 users | 100 users | 1,000 users | 10,000 users |
| --- | ---: | ---: | ---: | ---: |
| **Per month, as configured today** | **$9.56** | **$27.58** | **$62.57** | **$1,091.44** |
| In EUR | €8.41 | €24.27 | €55.06 | €960.46 |
| Per user | $0.96 | $0.28 | $0.06 | $0.11 |
| **With a 24-hour App Check token** | $9.56 | $27.58 | $62.57 | **$331.02** |

"Users" means monthly active users, of whom half open the app on a given day.

- **Up to 1,000 users the bill is the database.** Cloud SQL is 99% of it at 100 users and 82% at
  1,000, where the rest comes to $11.43, mostly reCAPTCHA's flat $8.
- **At 10,000 users App Check is three quarters of the bill.** Each App Check token is a reCAPTCHA
  assessment, and the 1-hour token Firebase defaults to makes every open tab mint one every 35
  minutes. That is $820.50 of the $1,091.44. Raising the token's lifetime to 24 hours, a console
  setting, brings the month to $331.02.
- **Hosting, Storage, the backend, builds and logs cost almost nothing.** The highest of them is
  Hosting, at $5.73 a month for 10,000 users.
- Above 1,100 users, each additional user adds about $0.096 a month at today's App Check setting, or
  $0.020 with a 24-hour token, plus the steps the database takes.

## What runs

Read from the project with `gcloud` on 2026-10-01:

| Piece | Configuration |
| --- | --- |
| Cloud SQL | `strategydance-instance`, PostgreSQL 18, Enterprise edition, `db-f1-micro` (shared core, 0.6 GiB RAM), 10 GB SSD, zonal in `us-central1-c`. Backups off, point-in-time recovery off, deletion protection off, storage auto-resize off |
| Data Connect | `strategydance-service` in `us-central1`, over that instance. App Check enforced |
| Cloud Run | `strategydance-backend`, 1 vCPU and 512 MiB, request-based billing, 0 to 20 instances, 80 requests per instance |
| Hosting | The single-page app. `/assets/*` is cached for a year, the HTML shell is revalidated on every load |
| Storage | `strategydance.firebasestorage.app`, a dual-region bucket (`NAM4`, Iowa and South Carolina), holding logos, banners and profile pictures. App Check enforced |
| Auth | Firebase Auth, not Identity Platform: email and password, and Google. App Check enforced |
| App Check | reCAPTCHA Enterprise, token lifetime 3,600 s, refreshed automatically |
| Artifact Registry | `cloud-run-source-deploy`, one backend image per release, no cleanup policy |
| Email | Resend, outside Google Cloud: one welcome email per account, one email per invitation |

The project is nine days old and has 3 accounts, so the metrics measure an idle system and a
handful of test sessions. They are used for what does not depend on the number of users (the size of
a response, a log line, an image layer, a release's build time) and to check the per-user figures
below.

## Unit prices

From the catalog, in `us-central1` where a service is regional:

| Service | Price | Free each month |
| --- | --- | --- |
| Cloud SQL, `db-f1-micro` | $0.0105 an hour | Data Connect's trial: 3 months on the instance it created |
| Cloud SQL, `db-g1-small` | $0.035 an hour | |
| Cloud SQL, dedicated core | $0.0413 a vCPU-hour and $0.007 a GiB-hour of RAM, doubled for high availability | |
| Cloud SQL, SSD | $0.17 a GB-month, doubled for high availability | |
| Cloud SQL, backups | $0.08 a GB-month | |
| Data Connect operations | $0.90 a million | 250,000 |
| Data Connect egress | $0.12 a GiB | 10 GiB |
| reCAPTCHA assessments | $8 flat from 10,001 to 100,000, then $1 a thousand | 10,000, shared by the whole organization |
| Hosting egress | $0.15 a GiB | 360 MiB a day |
| Hosting storage | $0.026 a GiB-month | 10 GiB |
| Storage, `NAM4` | $0.044 a GiB-month, $10 a million writes, $0.40 a million reads | none: the free tier covers single-region US buckets only |
| Storage egress | $0.12 a GiB | 100 GiB |
| Cloud Run | $0.000024 a vCPU-second, $0.0000025 a GiB-second, $0.40 a million requests | 180,000 vCPU-seconds, 360,000 GiB-seconds, 2 million requests |
| Cloud Build | $0.006 a minute | 2,500 minutes |
| Artifact Registry | $0.10 a GiB-month | 0.5 GiB |
| Cloud Logging | $0.50 a GiB | 50 GiB |
| Auth | nothing for email and Google sign-in | |
| Resend | Pro: $20 for 50,000 emails | 3,000 emails, at most 100 a day |

Cloud Run's free CPU and memory, the Data Connect trial and Resend come from their pricing pages,
since the catalog does not carry them. A month is 730 hours, as Google bills it.

## Usage

Everything that grows with users is counted per **active user-day**: one user opening the app on one
day. A month of `N` users holds `0.5 × N × 30.4` of them, so 10,000 users make 152,083 a month.

| Figure | Value | Where it comes from |
| --- | --- | --- |
| Days active | half the month | A daily-habit product's target. See [Sensitivity](#sensitivity) |
| Data Connect operations | 250 a day | Three sessions a day. A cold load of Today runs about 16 queries, each return to the tab refetches about 8, and an edit runs 2 to 3 operations. Six refocuses and five edits a session, plus Build in public and Team once a day, give 250. The heaviest test day measured 1,161 operations across the few people testing |
| Bytes per operation | 1,518 B | Measured: 3,405,014 B sent for 2,243 operations |
| App Check assessments | 6 a day | The SDK refreshes a token at half its lifetime plus 5 minutes: every 35 minutes at 1 hour. Three sessions of about an hour each mint 2. At 24 hours it is about 1 a day |
| Hosting | 5.0 MiB a user a month | Releases ship daily, so each active day downloads what changed since the last visit, about 0.3 MiB of the 0.5 MiB that Today loads, and each session revalidates the 10 KiB shell. Nothing downloads on a day the user stays away, and everything under `/assets/` is cached for a year |
| Database growth | 5.2 KB a day on disk | A log entry (about 1.5 KB of rich text with its indexes), three tasks, four checklist ticks and an activity row make 2.6 KB, doubled for Postgres overhead and dead rows. The data is sized after 12 months |
| Storage | 1.2 MiB stored, 2 MiB downloaded a user a month | A logo, a banner and a profile picture as uploaded. Organization images are cached as immutable, and the bucket served 6 MB in the nine days measured |
| Backend | 1 request a user a month, 1.5 s each | The welcome email, invitations and image uploads. 1.5 billable seconds per request is measured |
| Email | 0.15 a user a month | One welcome email per new account, and invitations |

Two of these rest on behaviour the documentation does not state. Whether Data Connect counts a live
query's push as an operation is not documented: counting one per push adds under 2% here, since a
solo user's own log write is most of what pushes. And six assessments a day assumes the tab is
closed between sessions: a tab left open all day mints about 14.

## The database, step by step

The load on Postgres is the busiest hour's operations. That hour is assumed to hold 15% of the day,
and each operation to cost 20 ms of database time, the median Data Connect measured on the
`db-f1-micro`:

```
peak operations a second = DAU × 250 × 0.15 / 3,600
cores busy at peak        = peak operations a second × 0.020 s
```

| Users | DAU | Peak | Cores busy | Data after a year | Instance | Per month |
| ---: | ---: | ---: | ---: | ---: | --- | ---: |
| 10 | 5 | 0.05 /s | 0.001 | 0.2 GiB | `db-f1-micro`, 10 GB | $9.40 |
| 100 | 50 | 0.5 /s | 0.01 | 0.3 GiB | `db-g1-small`, 10 GB | $27.28 |
| 1,000 | 500 | 5.2 /s | 0.10 | 1.1 GiB | `db-custom-1-3840`, 10 GB | $51.14 |
| 10,000 | 5,000 | 52 /s | 1.04 | 9.3 GiB | `db-custom-2-7680` with high availability, 20 GB | $205.16 |

A dedicated instance costs `(vCPUs × $0.0413 + GiB of RAM × $0.007) × 730`, twice that with high
availability. Each row includes the disk and backups kept for 7 days, about 1.5 times the data at
$0.08 a GB-month, which is a few cents to $1.11.

CPU is never what forces a step. Even 10,000 users keep half of two cores busy at their busiest
hour. The steps are bought for other reasons:

- **100 users: out of the `db-f1-micro`.** At 3 accounts it already reports its memory full and has
  80 MB in swap, with operations taking 1 to 2 s at the 99th percentile. It allows 25 connections and
  holds 11 while idle. `db-g1-small` triples the RAM for $17.88 more a month. Staying on the micro
  would make the 100-user month $9.70
- **1,000 users: a dedicated core.** Shared-core instances are outside Cloud SQL's SLA, and from
  here an outage is felt by hundreds of people a day. One vCPU and 3.75 GiB of RAM is ten times the
  load
- **10,000 users: two cores, and a standby.** 1.04 cores at peak needs a second core. 7.5 GiB of RAM
  holds the recent rows a day actually reads, out of 9.3 GiB on disk. High availability doubles the
  instance and its disk, $102.03 a month, so that a zone's failure moves Postgres rather than
  stopping the product. Without it the month is $995.91

The heavy case below needs 3.5 cores at 10,000 users: `db-custom-4-15360` with high availability,
$394.49 for the instance, $197.24 more than the plan.

## Costs by tier

In USD a month:

| Line | 10 users | 100 users | 1,000 users | 10,000 users |
| --- | ---: | ---: | ---: | ---: |
| Cloud SQL instance | 7.67 | 25.55 | 49.31 | 197.25 |
| Cloud SQL storage | 1.70 | 1.70 | 1.70 | 6.80 |
| Cloud SQL backups | 0.03 | 0.03 | 0.13 | 1.11 |
| Data Connect operations | 0.00 | 0.12 | 3.20 | 33.99 |
| Data Connect egress | 0.00 | 0.00 | 0.00 | 5.25 |
| App Check (reCAPTCHA) | 0.00 | 0.00 | 8.00 | 820.50 |
| Hosting egress | 0.00 | 0.00 | 0.00 | 5.73 |
| Storage | 0.00 | 0.01 | 0.06 | 0.64 |
| Cloud Run backend | 0.00 | 0.00 | 0.00 | 0.00 |
| Cloud Build | 0.00 | 0.00 | 0.00 | 0.00 |
| Artifact Registry | 0.17 | 0.17 | 0.17 | 0.17 |
| Cloud Logging | 0.00 | 0.00 | 0.00 | 0.00 |
| Resend | 0.00 | 0.00 | 0.00 | 20.00 |
| **Total** | **9.56** | **27.58** | **62.57** | **1,091.44** |
| **Total in EUR** | **8.41** | **24.27** | **55.06** | **960.46** |

How the larger lines come out at 10,000 users:

- **Data Connect operations**: 152,083 active days × 250 = 38.0 million, minus the free 250,000,
  at $0.90 a million: $33.99
- **App Check**: 152,083 × 6 = 912,500 assessments: $8 for the band up to 100,000, then 812,500 at
  $0.001: $820.50
- **Hosting**: 152,083 × 0.33 MiB = 48.9 GiB, or 1.61 GiB a day, of which 0.35 GiB is free:
  1.26 GiB × $0.15 × 30.4 days = $5.73
- **Data Connect egress**: 38.0 million × 1,518 B = 53.8 GiB, of which 10 GiB is free: $5.25
- **Resend**: 1,500 emails a month is inside the free plan's 3,000, but 49 a day on average is half
  its daily cap of 100. One launch day or a large invitation would go over, so this tier pays for Pro

The lines at zero are computed the same way. The backend runs 10,000 requests a month at 10,000
users, 15,000 vCPU-seconds against 180,000 free. A release builds in 1.7 minutes: 51 minutes a month
against 2,500. Logs come to about 2.6 GiB a month against 50, almost all of it Auth's request log at
4.5 KB an entry. Cloud SQL's own logs add 1.1 MB a day whatever the traffic.

## Where the free tiers end

In monthly active users, at the usage above:

| Free tier | Ends at |
| --- | ---: |
| Data Connect operations | 66 |
| reCAPTCHA, then $8 flat | 110 |
| reCAPTCHA's flat band, then $0.091 a user | 1,096 |
| Hosting egress | 2,186 |
| Data Connect egress | 1,860 |
| Resend's free plan, while the daily average stays under a quarter of its cap | about 5,000 |
| Storage egress | 51,200 |
| Cloud Run | 120,000 |

## Levers

**App Check's token lifetime.** Firebase allows 30 minutes to 7 days. A longer life means fewer
assessments, but a token stolen from a browser can be replayed for longer. It cannot sign anybody
in: every operation but the sign-in screen's email lookup still needs the user's own ID token. At
10,000 users:

| Lifetime | Refreshed every | Assessments a day | App Check a month | Total a month |
| --- | --- | ---: | ---: | ---: |
| 1 hour (now) | 35 min | 6 | $820.50 | $1,091.44 |
| 12 hours | 6 h 5 min | about 2 | $212.17 | $483.10 |
| 24 hours | 12 h 5 min | about 1 | $60.08 | $331.02 |

**High availability at 10,000 users.** $102.03 a month. It is the one step taken for resilience
rather than load, so it is the one to postpone if the money matters more.

**A cleanup policy on Artifact Registry.** Each backend release adds 0.21 GiB of image layers, the
`COPY . .` and `bun install` steps, and nothing deletes them. At one release a day that is 6.4 GiB
after a month, $0.59, and 75.7 GiB after a year, $7.52 a month, $48.65 over the year. A policy that
keeps the 10 newest images holds it at $0.17. The tables assume that policy.

**Refetch on focus.** The query client keeps TanStack Query's defaults, so returning to the tab
refetches everything mounted, about 8 queries. That is most of the 250 operations a day. At $0.90 a
million it costs little, but it is most of the database's load: a `staleTime` of a minute would let
the instance steps come later. The two live queries already keep the team and the log current.

## What to fix now

Found while measuring, and independent of growth:

- **Backups are off.** Enabling them with 7 days of point-in-time recovery costs about $0.03 a month
  today. Until then a mistaken migration or a lost disk loses everything
- **Deletion protection is off**, and storage auto-resize is off on a 10 GB disk. When the disk
  fills, the database stops taking writes. Both settings are free
- **The Data Connect trial ends** three months after the instance was created on 2026-09-22, so
  around 2026-12-22. From then the `db-f1-micro` costs $9.37 a month, its disk included
- **No cleanup policy on Artifact Registry**, as above. It holds 1.5 GiB after seven releases
- **Budgets could not be read.** The Budget API is off on the project. If the billing account has
  no budget, one with an alert at, say, twice the expected month would catch a runaway line, App
  Check above all

## Sensitivity

Totals a month, with the database kept at each tier's size:

| Case | 10 users | 100 users | 1,000 users | 10,000 users |
| --- | ---: | ---: | ---: | ---: |
| Light: 30% active a day, 150 operations, 4 assessments | $9.56 | $27.46 | $60.34 | $514.54 |
| **Base** | **$9.56** | **$27.58** | **$62.57** | **$1,091.44** |
| Heavy: 70% active a day, 600 operations, 14 assessments | $9.56 | $36.39 | $269.74 | $3,259.12 |
| Heavy, with a 24-hour token | $9.56 | $28.39 | $71.66 | $491.20 |

Under every assumption App Check's token lifetime moves the 10,000-user bill more than anything
else. The heavy case also needs the 4-core database described above, $197.24 more.

## Not included

- The domain, the `strategydance.com` mailbox, GitHub, and the Gemini calls `bun run translate`
  makes, which are per changed string and paid by developers rather than users
- Visitors to the landing page who never sign in: about 246 KB each, so 1,000 a day is 7 GiB a
  month, which shares Hosting's free 360 MiB a day with the users
- Tax, support, and committed-use discounts, which Cloud SQL offers only on dedicated tiers and
  applies as a credit rather than a price the catalog lists

## Reproducing the numbers

Prices, from the catalog, one service at a time:

```sh
TOKEN=$(gcloud auth print-access-token)
curl -s -H "Authorization: Bearer $TOKEN" -H "x-goog-user-project: strategydance" \
  "https://cloudbilling.googleapis.com/v1/services/9662-B51E-5089/skus?pageSize=5000"  # Cloud SQL
```

The service ids: Cloud SQL `9662-B51E-5089`, Data Connect `3C58-66D1-EF70`, Hosting
`2662-232A-AC11`, Cloud Storage `95FF-2EF5-5EA1`, Cloud Run `152E-C115-5142`, reCAPTCHA
`1B17-0E4A-E355`, Artifact Registry `149C-F9EC-3994`, Cloud Build `8B5D-EF7D-EB12`, Cloud Logging
`5490-F7B7-8DF6`. Adding `&currencyCode=EUR` returns the euro prices and the conversion rate.

The configuration:

```sh
gcloud sql instances describe strategydance-instance --project strategydance
gcloud run services describe strategydance-backend --project strategydance --region us-central1
gcloud artifacts repositories list --project strategydance
gcloud storage buckets describe gs://strategydance.firebasestorage.app
```

Usage, from Cloud Monitoring's `timeSeries` endpoint, summed per day:
`firebasedataconnect.googleapis.com/service/operation_count` grouped by `operation_name`,
`firebasedataconnect.googleapis.com/service/network/sent_bytes_count`,
`firebasehosting.googleapis.com/network/sent_bytes_count`,
`cloudsql.googleapis.com/database/memory/usage`, `cloudsql.googleapis.com/database/swap/bytes_used`,
`run.googleapis.com/container/billable_instance_time` and `logging.googleapis.com/byte_count`
grouped by resource type.
