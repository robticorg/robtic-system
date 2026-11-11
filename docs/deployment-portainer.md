# Deployment: Portainer stack `robtic-bots`

Five repositories, one stack on the bots server (192.168.1.137). Each repository's deploy workflow
builds its image on a GitHub-hosted runner, pushes it to GHCR, and calls the stack's Portainer webhook
from the self-hosted `robtic-deploy` runner on that server (Portainer is LAN-only); Portainer re-pulls
and recreates only the containers whose image changed. MongoDB 8 and Redis run on the database VM
(192.168.1.120, `/opt/robtic-db`), not in this stack.

| Repository | Workflow | Image | Containers |
|---|---|---|---|
| `robticorg/robtic-system` (this repo) | `deploy-bot.yml` | `ghcr.io/robticorg/robtic-system` | `robtic-system`, `robtic-system-standby`, `robtic-system-worker-1`, `robtic-system-worker-2`, `robtic-invites-api` |
| `robticorg/robtic-minecraft` | `deploy-api.yml` | `ghcr.io/robticorg/robtic-minecraft-api` | `robtic-minecraft-api` |
| `robticorg/robtic-staff` | `deploy.yml` | `ghcr.io/robticorg/robtic-staff` | `robtic-staff` |

> **robtic-shop is no longer in this stack** (2026-11-11): it's hosted elsewhere. Its service and the external
> `robtic-bots-shop-database` volume were removed from the manifest. While they were there, a missing volume made
> Portainer refuse the whole stack and every bot stayed down. The shop steps further down are history.

- Manifest: [`infra/docker/compose/portainer-robtic-bots.yml`](../infra/docker/compose/portainer-robtic-bots.yml).
  Images only, no `build:`.
- Variables (names only): [`infra/docker/portainer-robtic-bots.env.example`](../infra/docker/portainer-robtic-bots.env.example).
  Values live only in Portainer.
- Tags: every push publishes `:production` (what the stack runs) and `:sha-<full commit sha>` (never
  moves, so you can roll back to it). Nothing publishes or reads `:latest` any more.

## Networks and ports

No container publishes a host port.

| Network | Created by | Members | Purpose |
|---|---|---|---|
| `proxy` | outside the stack (existing) | `robtic-minecraft-api` only | Nginx Proxy Manager upstreams |
| `robtic-bots-internal` | this stack | every service except `robtic-shop` | calls between services, outbound internet |
| `robtic-bots-default` | this stack | `robtic-shop` | outbound internet only (no MongoDB/Redis use) |

### Which HTTP APIs need to be reachable from outside

| API | Port | Callers (found in code) | Exposure | NPM upstream |
|---|---|---|---|---|
| Minecraft API (`robtic-minecraft`, `apps/minecraft-api`) | 3002 | Minecraft game servers on other hosts (plugin `api.yml`) | **`proxy`**, `minecraft.api.robtic.org` | scheme `http`, host `robtic-minecraft-api`, port `3002` |
| Staff points API (`robtic-staff`, `src/modules/internal-api`) | 8788 | `robtic-system` and the workers (`libs/core/src/staff-api`, `STAFF_POINTS_API_URL`) | `internal` only, `http://robtic-staff:8788` | none |
| Bank API (`robtic-system`, `apps/bot/src/services/bank/api`) | 8790 | `robtic-staff` gift delivery (`AUTOCLAIM_API_URL`) | `internal` only, `http://robtic-system:8790` | none; it has **no authentication** and must never join `proxy` |
| Invites API (`internal-api/invites`) | 3005 | `robtic-system` (`INVITES_API_URL`) | `internal` only | none |

If a caller outside these four repositories ever needs the Staff points API, give it an NPM proxy
host to `robtic-staff:8788`, add `proxy` to `robtic-staff`'s networks, and set
`STAFF_INTERNAL_API_TOKEN` first. Without that token the API is open to anyone who can reach it.

The bank API is served by whichever Gateway currently leads. During a failover to
`robtic-system-standby`, `http://robtic-system:8790` refuses connections until the primary is back.
The old deployment behaved the same way: the standby published no ports.

#### Nginx Proxy Manager: `minecraft.api.robtic.org`

- Details: domain `minecraft.api.robtic.org`, scheme `http`, forward hostname `robtic-minecraft-api`,
  port `3002`. Leave *Cache Assets* off and *Block Common Exploits* on. Websockets are not needed.
- Advanced:

  ```nginx
  # Staff-mode snapshots carry a whole serialised inventory as Base64; the 1m default makes them 413.
  client_max_body_size 10m;
  # Every response is live state or a mutation. Never buffer or cache.
  proxy_buffering off;
  proxy_read_timeout 30s;
  ```

  NPM forwards the `Authorization` header (the plugin's API key) by default. Don't strip it.
- Cloudflare Tunnel: route `minecraft.api.robtic.org` to Nginx Proxy Manager, the same way as the other
  hostnames already behind it. No cache rules for this hostname.

## Configuration

Each variable is set once in Portainer and mapped to the name each application already reads. For
example, `ROBTIC_MONGODB_URI` becomes `MONGODB_URI` in five containers, and `STAFF_DISCORD_TOKEN`
becomes `DISCORD_TOKEN` in `robtic-staff` only. The template lists every mapping.

Values that differ from the old `.env` files:

- `ROBTIC_MONGODB_URI` must name MongoDB by its hostname **on the `backend` network**, not a host IP
  or `localhost`.
- `ROBTIC_REDIS_URL` points at the **central** Redis on `backend`; the stack has no Redis of its own.
  Use a database index nothing else uses (`redis://<redis-service>:6379/<n>`): the Gateway lock
  (`gateway:leader`), the message buffer (`act:msg:*`) and BullMQ (`bull:*`) use unprefixed keys.
  The Redis must run with `maxmemory-policy noeviction`, which BullMQ requires, and with persistence.
- `STAFF_POINTS_API_URL`, `INVITES_API_URL` and `AUTOCLAIM_API_URL` are now fixed container names in
  the manifest. Don't copy the old LAN IPs (`192.168.1.146`).

Tuning variables the old `.env` may hold (`WORKER_CONCURRENCY`, `DISCORD_OUTBOX_CONCURRENCY`,
`EXTERNAL_API_CONCURRENCY`, `ACTIVITY_FLUSH_MS`, `YTDLP_PATH`) aren't mapped, so the code defaults
apply. If production depended on one of them, add it to `x-robtic-system-env` in the manifest.

## Slash commands

The old pipeline ran `register-commands.ts` with `docker compose exec` on the self-hosted runner after
every push. Nothing on a GitHub-hosted runner can do that: MongoDB, which registration reads, is
reachable only on `backend`.

The replacement is behaviour the bots already had:

- **robtic-system**: the Gateway that wins leadership publishes every command as it starts
  (`libs/core/src/client-manager.ts`). Commands only change when the image changes, and a changed
  `:production` image makes Portainer recreate `robtic-system`, so every command change is published.
  A failure is logged as `Command registration failed` in the `robtic-system` log.
- **robtic-staff**: registers on startup unless `SKIP_COMMAND_REGISTRATION=true` (unchanged).
- **robtic-shop**: registers on startup (unchanged).

To re-run registration by hand without a restart, open Portainer → Containers → `robtic-system` →
Console (`/bin/sh`) and run:

```sh
bun --preload ./libs/shared/src/preload.ts apps/bot/src/register-commands.ts
```

It exits non-zero when any route failed.

## One-time setup (before cutover, no downtime)

1. **Merge the workflow changes** in all four repositories. `robtic-minecraft` must exist as
   `robticorg/robtic-minecraft` on GitHub first. Until `ROBTIC_BOTS_PORTAINER_WEBHOOK_URL` is set,
   pushes build and push images and redeploy nothing, so this step is safe to do early. From this
   point, pushes no longer update the old server.
2. **Let each repository push its package.** If `ghcr.io/robticorg/robtic-minecraft-api` already
   exists (the old `robtic-system` pipeline pushed it), open Package settings → *Manage Actions
   access* and add `robtic-minecraft` with **Write**. Do the same for any package whose owning
   repository is not the one that now pushes it.
3. **Publish the first images.** Run each deploy workflow once via *Run workflow* (for `Deploy bot`,
   tick `force`). Check that each package shows `production` and `sha-…` tags.
4. **Portainer registry.** Registries → Add registry → Custom: URL `ghcr.io`, username = a GitHub
   account in `robticorg`, password = a classic PAT with only `read:packages`.
5. **Prepare the variables.** Copy `infra/docker/portainer-robtic-bots.env.example` to a private
   location. Fill it from `/home/robtic/robtic-system/.env`, `/home/robtic/robtic-shop/.env` and
   `/home/robtic/robtic-staff/.env`, applying the changes listed under *Configuration*. Keep
   `ROBTIC_MUSIC_TOKEN_KEY` and `MINECRAFT_BOT_TOKEN_KEY` exactly as they are. Saved tokens
   can't be decrypted without them.
6. **Check the host** (Portainer → Networks, or SSH):

   ```bash
   docker network inspect backend proxy --format '{{.Name}} {{.Driver}}'
   docker network inspect backend --format '{{range .Containers}}{{.Name}} {{end}}'   # MongoDB + Redis names
   ```

7. **Nginx Proxy Manager.** Create the `minecraft.api.robtic.org` proxy host above. It shows offline
   until the stack runs. Don't move the Cloudflare route yet.

## Cutover

The old and new Discord bots must never run at the same time. The old stacks use their own Redis, so
the Gateway lock can't coordinate across them. Every old bot is stopped (not removed) before the new
stack is created. Expect a few minutes of downtime.

Old Compose projects on the server: `robtic-system` (Gateways, workers, invites API, `robtic-redis`,
**and `robtic-minecraft-api`**), `robtic-shop`, `robtic-staff`. The commands select containers by
their Compose labels, so container names don't matter. `docker stop` keeps a container stopped across
daemon restarts while leaving it in place for rollback.

```bash
P=label=com.docker.compose.project
S=label=com.docker.compose.service

# 0. Record what is running, for the rollback. (Repeated label filters are ANDed, hence the loop.)
for p in robtic-system robtic-shop robtic-staff; do
  docker ps --filter $P=$p --format '{{.Names}}\t{{.Image}}\t{{.Status}}'
done | tee ~/robtic-cutover-before.txt

# 1. Old Gateways: standby first, otherwise it takes over the moment the primary stops.
docker stop -t 30 $(docker ps -q --filter $P=robtic-system --filter $S=robtic-system-standby)
docker stop -t 30 $(docker ps -q --filter $P=robtic-system --filter $S=robtic-system)

# 2. Let the old workers finish: the queues and the message buffer must be empty.
#    Repeat until the output is all zeros twice in a row, about a minute apart (ACTIVITY_FLUSH_MS).
REDIS=$(docker ps -q --filter $P=robtic-system --filter $S=robtic-redis)
docker exec "$REDIS" sh -c '
  for q in $(redis-cli --scan --pattern "bull:*:meta" | cut -d: -f2 | sort -u); do
    echo "$q wait=$(redis-cli llen bull:$q:wait) active=$(redis-cli llen bull:$q:active) delayed=$(redis-cli zcard bull:$q:delayed) prioritized=$(redis-cli zcard bull:$q:prioritized)"
  done
  echo "act:msg pending/inflight keys: $(redis-cli exists act:msg:pending act:msg:inflight)"'

# 3. The rest of the old robtic-system project, including the old Minecraft API and its bot.
docker stop -t 30 $(docker ps -q --filter $P=robtic-system)

# 4. Old shop and staff bots.
docker stop -t 30 $(docker ps -q --filter $P=robtic-shop)
docker stop -t 30 $(docker ps -q --filter $P=robtic-staff)

# 5. Nothing old may be running: no output.
for p in robtic-system robtic-shop robtic-staff; do docker ps -q --filter $P=$p; done
```

### Shop data: old volume → new volume

The old project named the volume `robtic-shop_robtic-shop-database`; the stack expects
`robtic-bots-shop-database`, declared `external`. Until this step is done, Portainer refuses to deploy,
which stops it from creating an empty volume and filling it with the stale JSON baked into the image.
The old volume is only read, never changed.

```bash
docker volume ls --filter name=robtic-shop                       # expect robtic-shop_robtic-shop-database
docker run --rm -v robtic-shop_robtic-shop-database:/from:ro alpine:3.20 ls -ln /from

docker volume create robtic-bots-shop-database
docker run --rm \
  -v robtic-shop_robtic-shop-database:/from:ro \
  -v robtic-bots-shop-database:/to \
  alpine:3.20 sh -c 'cp -a /from/. /to/'

# Verify: identical content, and still owned by uid 1000 (the image runs as `node`).
docker run --rm \
  -v robtic-shop_robtic-shop-database:/from:ro \
  -v robtic-bots-shop-database:/to:ro \
  alpine:3.20 sh -c '
    (cd /from && find . -type f -exec md5sum {} + | sort -k2) > /tmp/a
    (cd /to   && find . -type f -exec md5sum {} + | sort -k2) > /tmp/b
    diff /tmp/a /tmp/b && echo "IDENTICAL: $(wc -l < /tmp/a) files"
    ls -ln /to'
```

If the `ls -ln /from` before the copy already shows something other than `1000`, keep it: `cp -a`
preserves whatever ownership the running bot had.

### Create the stack

Portainer → Stacks → **Add stack**:

1. Name `robtic-bots`. Build method **Repository**.
2. Repository URL `https://github.com/robticorg/robtic-system`, reference `refs/heads/main`, compose
   path `infra/docker/compose/portainer-robtic-bots.yml`. Turn on authentication with a fine-grained
   PAT that has read-only *Contents* on that repository.
3. **GitOps updates** on → mechanism **Webhook**. Copy the webhook URL. Turn on **Re-pull image** and
   **Force redeployment**: a push to shop, staff or minecraft changes no file in this repository,
   and without force Portainer would not redeploy.
4. Environment variables → *Advanced mode* → paste the prepared `NAME=value` lines.
5. **Deploy the stack.**

### Verify

```bash
docker ps --filter label=com.docker.compose.project=robtic-bots --format '{{.Names}}\t{{.Status}}'
docker logs robtic-system         2>&1 | grep -E "Leading as|Command registration|Bot initialized"
docker logs robtic-system-standby 2>&1 | grep -E "waiting as standby"
docker logs robtic-staff --tail 30
docker logs robtic-shop --tail 30
docker logs robtic-minecraft-api 2>&1 | grep "Listening on"

# Service-to-service paths.
docker exec robtic-system bun -e "console.log(await (await fetch('http://robtic-staff:8788/internal/health')).text())"
docker exec robtic-staff  bun -e "console.log(await (await fetch('http://robtic-system:8790/health')).text())"
docker exec robtic-system bun -e "console.log(await (await fetch('http://robtic-invites-api:3005/health')).status)"
```

All eight containers should be `healthy` (`robtic-shop` has no healthcheck and shows `Up`). Only one
Gateway logs `Leading as`. Then, in Discord, run one command on each bot and open the shop.

### Move the public Minecraft route

Point the Cloudflare Tunnel route for `minecraft.api.robtic.org` at Nginx Proxy Manager, then check
from anywhere:

```bash
curl -s https://minecraft.api.robtic.org/api/health
```

Disable the host Nginx vhost for `minecraft.api.robtic.org` afterwards. Keep it around, because the
rollback uses it.

### Turn on automatic redeploys

Add the webhook URL from *Create the stack* as `ROBTIC_BOTS_PORTAINER_WEBHOOK_URL`. Either make it an
organization secret limited to the four repositories, or add it as a repository secret in each. Run
one deploy workflow by hand and confirm the stack redeploys.

## Rolling back

### A bad image (stay on Portainer)

1. Find the last good commit: `git log` in that repository, or the package's tag list on GitHub.
2. Portainer → Stacks → `robtic-bots` → Environment variables: set the service's tag variable
   (`ROBTIC_SYSTEM_IMAGE_TAG`, `MINECRAFT_API_IMAGE_TAG`, `SHOP_IMAGE_TAG` or `STAFF_IMAGE_TAG`) to
   `sha-<full commit sha>` → **Update the stack** with *Re-pull image* on.
3. Fix or revert on `main`. When the new `:production` is good, clear the variable and update the
   stack again. While a tag is pinned, pushes still move `:production` but the stack does not follow.

### Back to the old deployment

The old containers, their `:latest` images and the old volumes are untouched. Don't run
`docker system prune` / `docker image prune -a` / `docker volume prune` until the old deployment is
retired.

```bash
P=label=com.docker.compose.project
S=label=com.docker.compose.service

# 1. Stop automatic redeploys: delete ROBTIC_BOTS_PORTAINER_WEBHOOK_URL in GitHub, or turn GitOps
#    updates off on the stack.

# 2. New Gateways first, standby first, then let the new workers drain the central Redis.
docker stop -t 30 robtic-system-standby
docker stop -t 30 robtic-system
#    Repeat until zero, with redis-cli on the central Redis and its database index (-n <n>):
#    the same wait/active/delayed/prioritized and act:msg:pending/inflight checks as in cutover step 2.

# 3. Stop the stack: Portainer → Stacks → robtic-bots → Stop. Do not delete it.
docker ps --filter $P=robtic-bots                                  # must be empty

# 4. Shop data. The old volume still holds the data as of the cutover. Pick one:
#    a) Discard shop changes made since the cutover: do nothing.
#    b) Keep them: copy the new volume back over the old one, after a backup.
docker volume create robtic-shop-database-before-rollback
docker run --rm -v robtic-shop_robtic-shop-database:/from:ro -v robtic-shop-database-before-rollback:/to \
  alpine:3.20 sh -c 'cp -a /from/. /to/'
docker run --rm -v robtic-bots-shop-database:/from:ro -v robtic-shop_robtic-shop-database:/to \
  alpine:3.20 sh -c 'rm -rf /to/* /to/.[!.]* 2>/dev/null; cp -a /from/. /to/'

# 5. Start the old containers: Redis and internal services first, primary Gateway before standby.
docker start $(docker ps -aq --filter $P=robtic-system --filter $S=robtic-redis)
docker start $(docker ps -aq --filter $P=robtic-system --filter $S=robtic-invites-api)
docker start $(docker ps -aq --filter $P=robtic-system --filter $S=robtic-worker)
docker start $(docker ps -aq --filter $P=robtic-system --filter $S=robtic-minecraft-api)
docker start $(docker ps -aq --filter $P=robtic-system --filter $S=robtic-system)
docker start $(docker ps -aq --filter $P=robtic-system --filter $S=robtic-system-standby)
docker start $(docker ps -aq --filter $P=robtic-shop)
docker start $(docker ps -aq --filter $P=robtic-staff)
diff <(docker ps --format '{{.Names}}' | sort) <(cut -f1 ~/robtic-cutover-before.txt | sort)

# 6. Point minecraft.api.robtic.org back at the host Nginx vhost (Cloudflare) and re-enable the vhost.
```

The old self-hosted pipeline no longer exists on `main`. Until the workflow commits are reverted,
pushes publish images and redeploy nothing on the old server.
