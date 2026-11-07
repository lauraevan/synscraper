"""CLI for reusing every Synscraper provider outside the web frontend.

Usage:
    synscraper-providers list
    synscraper-providers resolve --type movie --id 550 --provider vidfast
"""

import argparse
import asyncio
import json
import sys

import provider_api
import scraper


def build_parser():
    parser = argparse.ArgumentParser(description="Synscraper reusable resolver CLI")
    commands = parser.add_subparsers(dest="command", required=True)
    commands.add_parser("list", help="List all registered provider IDs")
    resolve = commands.add_parser("resolve", help="Run one or all registered resolvers")
    resolve.add_argument("--type", choices=("movie", "tv", "anime"), default="movie")
    resolve.add_argument("--id", required=True, help="TMDB ID (AniList ID for anime)")
    resolve.add_argument("--season", type=int)
    resolve.add_argument("--episode", type=int)
    resolve.add_argument("--provider", help="Provider ID from the list command")
    resolve.add_argument("--mirror", help="Optional Vidy mirror")
    resolve.add_argument("--exclude", help="Comma-separated provider IDs to exclude")
    resolve.add_argument("--title", help="Optional title for providers that support metadata hints")
    resolve.add_argument("--year", type=int)
    resolve.add_argument("--imdb-id")
    return parser


def main(argv=None):
    args = build_parser().parse_args(argv)
    if args.command == "list":
        print(json.dumps(provider_api.list_providers(), indent=2))
        return 0

    try:
        provider_api.validate_request(args.type, args.id, args.season, args.episode, args.provider)
    except (ValueError, LookupError) as exc:
        print(f"Invalid request: {exc}", file=sys.stderr)
        return 2

    metadata_hint = None
    if args.title:
        metadata_hint = {"title": args.title, "year": args.year, "imdbId": args.imdb_id or ""}

    streams = asyncio.run(scraper.scrape_streams(
        args.type, args.id, args.season, args.episode,
        provider_id=args.provider, mirror=args.mirror, exclude=args.exclude,
        metadata_hint=metadata_hint,
    ))
    print(json.dumps({
        "version": provider_api.API_VERSION,
        "type": args.type,
        "id": args.id,
        "season": args.season,
        "episode": args.episode,
        "count": len(streams),
        "servers": streams,
    }, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
