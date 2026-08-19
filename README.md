# AI Director + Reader Runtime

An experimental reader where the source book controls what is said and the
director layer controls only how it is presented.

The project is currently in Phase 1: reproducible development environment and
minimal workspace scaffolding. Reader behavior, book importing, data schemas,
and AI integration are intentionally not implemented yet.

## Development

Prerequisites:

- Nix with flakes enabled
- direnv with its shell hook installed

Enter the development environment:

```sh
direnv allow
just versions
```

Run all current checks:

```sh
just check
```

Start the placeholder Reader page:

```sh
just dev
```

See [the implementation plan](docs/implementation-plan.md) for architecture,
phase boundaries, and acceptance criteria.
