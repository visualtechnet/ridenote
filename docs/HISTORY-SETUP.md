# Setting up History (Neon and Vercel), step by step

This is the exact setup the live site uses, written so you can follow it without having done it before.
It takes about 30 minutes. You do it **once**. Nothing here needs a command line except an optional check
at the end.

**What you are building.** A small Postgres database (Neon) that stores each parsed trip for 7 days, and two
database logins with deliberately small powers:

| Login           | Can do                 | Cannot do             | Used by                              |
| --------------- | ---------------------- | --------------------- | ------------------------------------ |
| `history_app`   | add rows, read rows    | change or delete rows | the parse route and the History page |
| `history_purge` | read rows, delete rows | add or change rows    | the daily clean-up route only        |

Because of this, even if the app were tricked, it could not erase or rewrite history. The setup script
(`db/schema.sql`) creates the table and both logins, and checks that neither has more than it should.

**Rules for the whole guide.** Never put a password or connection string in the repository, in a chat, or in
an email. They go only into Neon and into Vercel's environment variables.

## Before you start

- A Vercel project with RideNote deployed (see the README, "Deploying to Vercel").
- Access to that project's settings (you are the owner or a member with permission).

## 1. Create the database

1. In Vercel, open your project and click **Storage**.
2. Choose **Create Database**, then **Neon** (Postgres). Accept the defaults and create it.
3. Open the new database and click **Open in Neon**. This opens the Neon console.

## 2. Create the table and the two logins

1. In the Neon console open **SQL Editor**.
2. Open `db/schema.sql` from this repository, copy **all** of it, paste it into the editor and click **Run**.
3. It must finish without an error. If the last block raises `history roles have more than their grants`,
   stop: one of the logins holds a power it should not. Do not continue until that is fixed.

Run it as the database owner (Neon's default login, `neondb_owner`). The script creates the two logins
itself. **Do not create them in the console's Roles page**: a login made there is given broad powers that
the script cannot take away.

Check it worked. Run this in the SQL Editor:

```sql
select rolname from pg_roles where rolname in ('history_app', 'history_purge');
select count(*) from history;
```

You should see both names, and a count of `0`.

> **You may not see the new logins on Neon's Roles page.** In our setup that page listed only
> `neondb_owner`. Logins created with SQL did not appear there. They exist anyway; the query above is the
> proof. Use SQL, not the Roles page, to manage them.

## 3. Give each login a password

In the SQL Editor run these two statements, replacing each placeholder with a **long random password**
(use your password manager's generator; letters and digits only avoids quoting problems):

```sql
alter role history_app   password 'REPLACE-WITH-A-LONG-RANDOM-PASSWORD';
alter role history_purge password 'REPLACE-WITH-A-DIFFERENT-LONG-RANDOM-PASSWORD';
```

Save both passwords in your password manager now. Neon cannot show them again. Do not leave them in the
SQL Editor's saved history if you can avoid it.

## 4. Build the two connection strings

Neon gives you **one** connection string, for the owner. You make the other two by changing the user name
and password in it.

1. In the Neon console click **Connect** and copy the **pooled** connection string. It looks like:

   ```
   postgresql://neondb_owner:OWNER-PASSWORD@ep-example-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require
   ```

   The host contains `-pooler`. Keep it: serverless functions need the pooled host.

2. Make the **app** string: replace `neondb_owner` with `history_app` and `OWNER-PASSWORD` with the
   `history_app` password from step 3.
3. Make the **purge** string the same way, with `history_purge` and its password.
4. In both strings, **delete `&channel_binding=require`** (keep `?sslmode=require`). The driver the app
   uses does not support channel binding.

You now have:

```
HISTORY_DATABASE_URL        = postgresql://history_app:APP-PASSWORD@ep-example-pooler.../neondb?sslmode=require
HISTORY_PURGE_DATABASE_URL  = postgresql://history_purge:PURGE-PASSWORD@ep-example-pooler.../neondb?sslmode=require
```

If a password contains characters such as `@`, `/` or `#`, they must be percent-encoded in the URL. Letters
and digits avoid this.

## 5. Prove the logins have only their powers (optional, recommended)

`db/verify.sql` tries to do forbidden things as each login and confirms they fail. Open it, read the header
comment, and run it in the SQL Editor, **in pieces** (each numbered section on its own). It was run by hand
like this, not as one script.

Why pieces and why the `grant`: Neon's owner is not a superuser, so `set role history_app` fails with
`permission denied to set role` until the owner is made a member of the role. The file does that for you, and
removes the membership at the end.

Expected result, in short: `history_app` can insert and select but its delete is refused; `history_purge`
can select and delete but its insert is refused.

## 6. Add the environment variables in Vercel

1. In Vercel open the project, then **Settings**, then **Environment Variables**.
2. Add these three. For each, tick **Production only** and turn on **Sensitive**:

   | Name                         | Value                                                                  |
   | ---------------------------- | ---------------------------------------------------------------------- |
   | `HISTORY_DATABASE_URL`       | the app string from step 4                                             |
   | `HISTORY_PURGE_DATABASE_URL` | the purge string from step 4                                           |
   | `CRON_SECRET`                | a long random string (30+ characters) that you make up and keep secret |

   Production only matters: History is switched on by `HISTORY_DATABASE_URL`, and previews and local runs
   must never open a database connection.

3. Go to **Deployments**, open the latest production deployment's menu and choose **Redeploy**. Variables
   only reach a deployment that is built after they are saved.

## 7. Test it

1. Open the live site and parse the example note once. Then open `/history`: the trip should appear as a
   card. (If you see "History is not available", `HISTORY_DATABASE_URL` is missing or the redeploy has not
   finished.)
2. Within one minute, parse the example note **five times**. The fourth should be refused with "You're going
   a bit fast", and `/history` should list **three** entries.

## 8. Add the rate-limit rule (Vercel Firewall)

The app limits each address in code, but the edge rule stops abuse before it reaches the app.

1. In the project open **Firewall**, then **New Rule**.
2. Match **Request Path** equals `/api/parse` and **Method** equals `POST`.
3. Choose rate limiting with the key **IP address**, a **fixed window** of **60 seconds** and a limit of
   **3** requests.
4. Set the action to **Log** first. Click **Review Changes**, then **Publish**.
5. After a few days of real traffic, look at the Firewall overview. If only abusive traffic was logged, edit
   the rule, change the action to **Deny** (or the default 429), and publish again.

Dashboard field names change from time to time. Follow what the page shows; the settings above are what
matter.

## 9. Check the daily clean-up ran

The clean-up deletes rows older than 7 days. It is a Vercel cron job (`vercel.json`) that calls
`/api/history/purge` at `0 4 * * *`.

1. Right after the first production deploy, open **Settings**, then **Cron Jobs**. The job
   `/api/history/purge` must be listed.
2. The day after, open the project's **Logs**, filter by that path, and confirm a request around 04:00 that
   returned `200`. Vercel's documentation does not say which time zone the schedule uses, so note the time
   you see in the logs here: **time zone observed: _(fill in)_**.
3. To prove it end to end, you can wait 8 days and confirm the oldest row is gone, or ask the owner to run
   `select min(created_at) from history;` in the SQL Editor and check that it is never older than 7 days
   plus a day.

If the clean-up does not run (a missing `CRON_SECRET` or `HISTORY_PURGE_DATABASE_URL`), nothing breaks
visibly: rows simply live for about 8 days or more. Check the logs rather than assuming.

## 10. Reset the owner password if it was ever exposed

If the owner (`neondb_owner`) password was pasted anywhere it should not have been (a chat, a ticket, a
screenshot), reset it: in the Neon console open **Roles**, choose `neondb_owner`, then **Reset password**.
The two app logins are unaffected, because they have their own passwords. If Vercel has any variables that
Neon's integration injected (for example `DATABASE_URL`), refresh them from the Storage tab afterwards.

## Troubleshooting

| Symptom                                                             | Likely cause and fix                                                                                                                             |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Schema script ends with `history roles have more than their grants` | A login was made in the console (it joins `neon_superuser`) or someone granted extra powers. Drop the login with SQL, then run the script again. |
| New logins missing from Neon's Roles page                           | Normal. Check with `select rolname from pg_roles ...` in the SQL Editor.                                                                         |
| `set role history_app` says `permission denied to set role`         | The owner is not a superuser on Neon. `grant history_app to neondb_owner;` first, and `revoke history_app from neondb_owner;` afterwards.        |
| `password authentication failed for user "history_app"`             | The password in the URL does not match the one set in step 3, or it needs percent-encoding. Set it again with `alter role`.                      |
| Connection error mentioning channel binding                         | Remove `&channel_binding=require` from the string.                                                                                               |
| `/history` empty although you parsed notes                          | Variables set for the wrong environment, or no redeploy after saving them. Set for Production, redeploy.                                         |
| Parsing works but nothing is saved                                  | `HISTORY_DATABASE_URL` points to a login without `INSERT`, or the table is missing. Re-run the schema.                                           |
| Old rows never disappear                                            | Clean-up not running: check `CRON_SECRET`, `HISTORY_PURGE_DATABASE_URL`, and the cron job's logs (step 9).                                       |
| Purge returns 401                                                   | `CRON_SECRET` in Vercel differs from what the cron sends. Re-save it and redeploy.                                                               |
