# infra/docker

Every Docker artefact in the system, in one place.

```text
infra/
└── docker/
    ├── dockerfiles/
    │   └── bot.Dockerfile               → ghcr.io/robticorg/robtic-system
    ├── compose/
    │   ├── portainer-robtic-bots.yml    production: the Portainer stack robtic-bots (images only)
    │   ├── docker-compose.yml           legacy self-hosted topology, kept for the cutover rollback
    │   └── docker-compose.local.yml     developer stack
    ├── portainer-robtic-bots.env.example  stack variable names (no values)
    ├── scripts/
    │   └── build.sh                     builds any one image, from anywhere in the repo
    ├── configs/                         reserved; see .gitkeep
    └── README.md
```

`infra/` is the parent on purpose: Terraform, Ansible or Kubernetes manifests get a sibling of
`docker/` rather than another top-level directory.

## Everyday commands

Run these from the repository root — the paths are baked into the root `package.json`, so nothing
here requires you to `cd` anywhere.

```bash
bun run docker:local -- up --build            # developer stack
bun run docker:local -- --profile tools up -d # mongo-express
bun run docker:local -- down

bun run docker:build bot                      # one image

docker compose -f infra/docker/compose/portainer-robtic-bots.yml config -q   # lint production (needs the variables)
```

`bun run <script> -- <args>` forwards everything after `--` to `docker compose`.

## Build context

**The context is the repository root for every image.** The Dockerfiles no longer sit next to what
they build, so each names its context in a header comment, and `scripts/build.sh` is the one place
that knows the mapping.

Two path rules trip people up here, and the Compose files depend on both:

- `build.context` is resolved relative to **the Compose file's own directory** — hence `../../..`.
- `build.dockerfile` is then resolved relative to **the context**, not the Compose file — hence
  `infra/docker/dockerfiles/x.Dockerfile`.

## What deliberately did *not* move

### `.dockerignore`

Docker reads `.dockerignore` from the **context root**, not from beside the Dockerfile. Moving it
into `infra/docker/` would silently stop it applying, and the first symptom would be a slow build
shipping `node_modules` into an image. The repository-root `.dockerignore` applies to every image.

## Production

Production is the Portainer stack `robtic-bots`, created from
`compose/portainer-robtic-bots.yml` in this repository and redeployed by its webhook. It holds no
`build:` blocks and no `.env` paths. Images come from GHCR, and values come from the stack's
environment variables. See [`../../docs/deployment-portainer.md`](../../docs/deployment-portainer.md).
